// Ratings live in their own Postgres schema (default `listening`), created on start-up: this is
// local evaluation tooling, so it stays out of the product migrations and is never reachable by
// the API's roles.
import type pg from 'pg'

const IDENT = /^[a-z_][a-z0-9_]{0,62}$/

export interface Rater {
  name: string
  instrument: string
  experience: string
}

export class Store {
  readonly #pool: pg.Pool
  readonly #schema: string

  constructor(pool: pg.Pool, schema = 'listening') {
    if (!IDENT.test(schema)) throw new TypeError('invalid schema name')
    this.#pool = pool
    this.#schema = schema
  }

  async bootstrap(): Promise<void> {
    const s = this.#schema
    await this.#pool.query(`
      create schema if not exists ${s};
      create table if not exists ${s}.raters (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        instrument text not null,
        experience text not null,
        created_at timestamptz not null default now()
      );
      create table if not exists ${s}.ratings (
        session_id text not null,
        rater_id uuid not null references ${s}.raters(id) on delete cascade,
        item text not null,
        score smallint not null check (score between 1 and 5),
        answered_at timestamptz not null default now(),
        primary key (session_id, rater_id, item)
      );
      create table if not exists ${s}.preferences (
        session_id text not null,
        rater_id uuid not null references ${s}.raters(id) on delete cascade,
        pair text not null,
        -- the item the rater preferred (sides are shuffled per rater), or null for "no preference"
        preferred text,
        answered_at timestamptz not null default now(),
        primary key (session_id, rater_id, pair)
      );
    `)
  }

  async addRater(rater: Rater): Promise<string> {
    const { rows } = await this.#pool.query<{ id: string }>(
      `insert into ${this.#schema}.raters (name, instrument, experience) values ($1, $2, $3) returning id`,
      [rater.name, rater.instrument, rater.experience],
    )
    const row = rows[0]
    if (!row) throw new Error('rater insert returned nothing')
    return row.id
  }

  async hasRater(id: string): Promise<boolean> {
    const { rowCount } = await this.#pool.query(
      `select 1 from ${this.#schema}.raters where id = $1`,
      [id],
    )
    return rowCount === 1
  }

  async saveRating(session: string, rater: string, item: string, score: number): Promise<void> {
    await this.#pool.query(
      `insert into ${this.#schema}.ratings (session_id, rater_id, item, score) values ($1, $2, $3, $4)
       on conflict (session_id, rater_id, item) do update set score = excluded.score, answered_at = now()`,
      [session, rater, item, score],
    )
  }

  async savePreference(
    session: string,
    rater: string,
    pair: string,
    preferred: string | null,
  ): Promise<void> {
    await this.#pool.query(
      `insert into ${this.#schema}.preferences (session_id, rater_id, pair, preferred) values ($1, $2, $3, $4)
       on conflict (session_id, rater_id, pair) do update set preferred = excluded.preferred, answered_at = now()`,
      [session, rater, pair, preferred],
    )
  }

  async answers(
    session: string,
    rater: string,
  ): Promise<{ ratings: Map<string, number>; preferred: Map<string, string | null> }> {
    const ratings = await this.#pool.query<{ item: string; score: number }>(
      `select item, score from ${this.#schema}.ratings where session_id = $1 and rater_id = $2`,
      [session, rater],
    )
    const prefs = await this.#pool.query<{ pair: string; preferred: string | null }>(
      `select pair, preferred from ${this.#schema}.preferences where session_id = $1 and rater_id = $2`,
      [session, rater],
    )
    return {
      ratings: new Map(ratings.rows.map((r) => [r.item, r.score])),
      preferred: new Map(prefs.rows.map((p) => [p.pair, p.preferred])),
    }
  }
}
