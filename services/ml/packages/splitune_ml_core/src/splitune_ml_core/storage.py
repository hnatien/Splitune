"""S3 access with the worker's own bucket credentials (SeaweedFS locally, Cloudflare R2)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from .errors import StageError

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

    from .settings import Settings

_CHUNK = 1 << 20


@dataclass(frozen=True)
class ObjectInfo:
    bytes: int


class Storage:
    def __init__(self, client: S3Client, bucket: str) -> None:
        self._s3 = client
        self.bucket = bucket

    @staticmethod
    def from_settings(settings: Settings) -> Storage:
        client = boto3.client(  # pyright: ignore[reportUnknownMemberType]
            "s3",
            endpoint_url=settings.s3_endpoint,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id.get_secret_value(),
            aws_secret_access_key=settings.s3_secret_access_key.get_secret_value(),
            config=Config(
                s3={"addressing_style": "path" if settings.s3_force_path_style else "auto"},
                retries={"max_attempts": 5, "mode": "standard"},
                connect_timeout=10,
                read_timeout=60,
                # Same as the TS adapter: S3-compatible stores need not support the newer default
                # checksums.
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )
        return Storage(client, settings.s3_bucket)

    def head(self, key: str) -> ObjectInfo | None:
        try:
            out = self._s3.head_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                return None
            raise
        return ObjectInfo(bytes=int(out["ContentLength"]))

    def download(self, key: str, dest: Path, *, max_bytes: int | None = None) -> str:
        """Streams an object to `dest` and returns its sha256. Refuses objects over `max_bytes`."""
        try:
            out = self._s3.get_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                raise StageError("input_missing", retry=False) from exc
            raise
        if max_bytes is not None and int(out["ContentLength"]) > max_bytes:
            out["Body"].close()
            raise StageError("input_too_large", retry=False)
        digest = hashlib.sha256()
        size = 0
        dest.parent.mkdir(parents=True, exist_ok=True)
        with dest.open("wb") as f:
            for chunk in out["Body"].iter_chunks(_CHUNK):
                size += len(chunk)
                if max_bytes is not None and size > max_bytes:
                    raise StageError("input_too_large", retry=False)
                digest.update(chunk)
                f.write(chunk)
        return digest.hexdigest()

    def get_bytes(self, key: str, *, max_bytes: int) -> bytes:
        out = self._s3.get_object(Bucket=self.bucket, Key=key)
        if int(out["ContentLength"]) > max_bytes:
            out["Body"].close()
            raise StageError("input_too_large", retry=False)
        return out["Body"].read()

    def put_file(self, key: str, path: Path, content_type: str) -> None:
        with path.open("rb") as f:
            self._s3.put_object(Bucket=self.bucket, Key=key, Body=f, ContentType=content_type)

    def copy(self, source_key: str, dest_key: str) -> None:
        self._s3.copy_object(
            Bucket=self.bucket,
            Key=dest_key,
            CopySource={"Bucket": self.bucket, "Key": source_key},
            MetadataDirective="COPY",
        )

    def delete(self, key: str) -> None:
        self._s3.delete_object(Bucket=self.bucket, Key=key)
