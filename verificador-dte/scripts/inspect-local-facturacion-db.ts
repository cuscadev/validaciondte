import pg from 'pg';

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ||
  'postgres://facturacion:facturacion123@localhost:5433/facturacion?sslmode=disable';

async function main() {
  const pool = new pg.Pool({ connectionString: LOCAL_URL });
  const tables = await pool.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log('=== BD LOCAL ===');
  for (const { table_name } of tables.rows) {
    const count = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM "${table_name}"`,
    );
    const n = Number(count.rows[0]?.n || 0);
    if (n > 0) {
      console.log(`${table_name}: ${n}`);
    }
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
