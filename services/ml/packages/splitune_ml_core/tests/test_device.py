from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from splitune_ml_core.device import empty_cache, peak_memory, synchronize, torch_device
from splitune_ml_core.errors import StageError


def test_torch_device_auto_picks_cuda(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ML_TORCH_DEVICE", raising=False)
    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = True
    with patch.dict("sys.modules", {"torch": mock_torch}):
        assert torch_device() == "cuda"


def test_torch_device_auto_picks_mps_when_cuda_absent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_TORCH_DEVICE", "auto")
    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = False
    mock_torch.backends.mps.is_available.return_value = True
    with patch.dict("sys.modules", {"torch": mock_torch}):
        assert torch_device() == "mps"


def test_torch_device_auto_picks_cpu_when_no_accelerator(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_TORCH_DEVICE", "auto")
    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = False
    mock_torch.backends.mps.is_available.return_value = False
    with patch.dict("sys.modules", {"torch": mock_torch}):
        assert torch_device() == "cpu"


def test_torch_device_explicit_cuda(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_TORCH_DEVICE", "cuda")
    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = True
    with patch.dict("sys.modules", {"torch": mock_torch}):
        assert torch_device() == "cuda"


def test_torch_device_explicit_cuda_fails_when_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_TORCH_DEVICE", "cuda")
    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = False
    with patch.dict("sys.modules", {"torch": mock_torch}):
        with pytest.raises(StageError) as exc:
            torch_device()
        assert exc.value.code == "device_unavailable"


def test_torch_device_explicit_mps(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_TORCH_DEVICE", "mps")
    mock_torch = MagicMock()
    mock_torch.backends.mps.is_available.return_value = True
    with patch.dict("sys.modules", {"torch": mock_torch}):
        assert torch_device() == "mps"


def test_torch_device_explicit_mps_fails_when_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_TORCH_DEVICE", "mps")
    mock_torch = MagicMock()
    mock_torch.backends.mps.is_available.return_value = False
    with patch.dict("sys.modules", {"torch": mock_torch}):
        with pytest.raises(StageError) as exc:
            torch_device()
        assert exc.value.code == "device_unavailable"


def test_torch_device_explicit_cpu(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_TORCH_DEVICE", "cpu")
    mock_torch = MagicMock()
    with patch.dict("sys.modules", {"torch": mock_torch}):
        assert torch_device() == "cpu"


def test_torch_device_invalid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_TORCH_DEVICE", "tpu")
    mock_torch = MagicMock()
    with patch.dict("sys.modules", {"torch": mock_torch}):
        with pytest.raises(StageError) as exc:
            torch_device()
        assert exc.value.code == "device_invalid"


def test_device_helpers_cuda(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_TORCH_DEVICE", "cuda")
    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = True
    mock_torch.cuda.max_memory_allocated.return_value = 10485760  # 10 MB
    with patch.dict("sys.modules", {"torch": mock_torch}):
        synchronize()
        mock_torch.cuda.synchronize.assert_called_once()
        empty_cache()
        mock_torch.cuda.empty_cache.assert_called_once()
        with peak_memory() as peak:
            pass
        assert round(peak[0], 2) == 10.0
