import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'https://wafcgdcgqkmsngwqhded.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!url || !key) {
    console.error('Missing URL or service role key');
    return;
  }
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    const data = await res.json() as any;
    const paths = Object.keys(data.paths || {});
    console.log('Available REST endpoints & RPCs:');
    const rpcs = paths.filter(p => p.startsWith('/rpc/'));
    console.log(rpcs);
  } catch (err: any) {
    console.error('Error fetching endpoints:', err.message);
  }
}

main();
