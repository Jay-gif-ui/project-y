declare module "pg" {
  export interface QueryResult<Row> {
    rows: Row[];
  }

  export interface PoolClient {
    query<Row = Record<string, never>>(
      text: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<Row>>;
    release(): void;
  }

  export class Pool {
    constructor(options?: { connectionString?: string; max?: number });
    query<Row = Record<string, never>>(
      text: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<Row>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
