// One-off: list available chat models on the NVIDIA NIM API.
const key = process.env.NVIDIA_API_KEY;
const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
  headers: { Authorization: `Bearer ${key}` }
});
console.log('HTTP', res.status);
const data = await res.json();
const ids = (data.data || []).map(m => m.id).sort();
console.log('total models:', ids.length);
const interesting = ids.filter(id => /llama|nemotron|mistral|qwen/i.test(id));
console.log(interesting.join('\n'));
process.exit(0);
