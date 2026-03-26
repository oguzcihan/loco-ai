import chalk from 'chalk';

const BASE_URL = 'http://localhost:11434';

export async function checkOllamaRunning() {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels() {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/tags`);
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error('Ollama is not running. Start it with "ollama serve" or open the Ollama app.');
    }
    throw new Error(`Could not connect to Ollama: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`Ollama API error (${res.status}). Is Ollama running?`);
  }

  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}

export async function pullModel(modelName) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, stream: true }),
    });
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error('Ollama is not running. Start it with "ollama serve" or open the Ollama app.');
    }
    throw new Error(`Could not connect to Ollama: ${err.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to pull model "${modelName}": ${body || res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastLine = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;

      let data;
      try {
        data = JSON.parse(line);
      } catch {
        continue;
      }

      if (data.error) {
        throw new Error(`Pull failed: ${data.error}`);
      }

      // Build a human-readable progress line
      let progressLine = data.status || '';
      if (data.total && data.completed) {
        const pct = Math.round((data.completed / data.total) * 100);
        const completedMB = (data.completed / 1e6).toFixed(0);
        const totalMB = (data.total / 1e6).toFixed(0);
        progressLine = `${data.status}  ${completedMB}MB / ${totalMB}MB  ${pct}%`;
      }

      // Overwrite the current line in terminal
      if (progressLine !== lastLine) {
        process.stdout.write(`\r${chalk.dim(progressLine)}${' '.repeat(20)}`);
        lastLine = progressLine;
      }

      if (data.status === 'success') {
        process.stdout.write('\r' + ' '.repeat(lastLine.length + 20) + '\r');
        return;
      }
    }
  }

  // Clear any remaining progress line
  if (lastLine) {
    process.stdout.write('\r' + ' '.repeat(lastLine.length + 20) + '\r');
  }
}

export async function generate(prompt, model) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: { num_predict: 200 },
        think: false,
      }),
    });
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error('Ollama is not running. Start it with "ollama serve" or open the Ollama app.');
    }
    throw new Error(`Could not connect to Ollama: ${err.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 404) {
      throw new Error(`Model "${model}" not found. Run "loco setup" or "ollama pull ${model}" first.`);
    }
    throw new Error(`Ollama generate error (${res.status}): ${body || 'unknown error'}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;

      let data;
      try {
        data = JSON.parse(line);
      } catch {
        continue;
      }

      if (data.error) {
        throw new Error(`Generation failed: ${data.error}`);
      }

      if (data.response) {
        result += data.response;
      }

      if (data.done) {
        return result;
      }
    }
  }

  return result;
}
