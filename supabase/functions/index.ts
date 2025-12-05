
console.log("Edge Functions Router Started");

Deno.serve(async (req: Request) => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
