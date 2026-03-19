import mssql from 'mssql';
import dotenv from 'dotenv';

console.log('[DEBUG] SQL Tool module loaded');

dotenv.config();

const config: mssql.config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME,
    options: {
        encrypt: true, // For Azure
        trustServerCertificate: true // For local dev
    }
};

export const executeSqlQueryDefinition = {
    name: 'execute_sql_query',
    description: 'Execute a SQL query on the configured SQL Server database.',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'The SQL query to execute.' }
        },
        required: ['query']
    }
};

export async function executeSqlQuery(query: string): Promise<any> {
    try {
        const pool = await mssql.connect(config);
        const result = await pool.request().query(query);
        console.log(`[SQL Tool] Query: ${query}`);
        console.log(`[SQL Tool] Raw result samples:`, JSON.stringify(result.recordset?.slice(0, 2)));
        await pool.close();
        return {
            recordset: result.recordset,
            rowsAffected: result.rowsAffected
        };
    } catch (error: any) {
        console.error("[SQL Tool Error]:", error);
        return { error: error.message };
    }
}
