export async function streamChatResponse({
  payload,
  token,
  onToken,
  onDone,
}) {
  const response = await fetch('/api/ai/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Streaming failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let receivedAnyToken = false;
  let finalAnswer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE frames separated by a blank line.
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s?/, ''));

      if (dataLines.length) {
        const payloadText = dataLines.join('');
        try {
          const event = JSON.parse(payloadText);
          if (event.type === 'token') {
            const tokenChunk = event.content || '';
            if (tokenChunk) {
              receivedAnyToken = true;
              onToken?.(tokenChunk);
            }
          } else if (event.type === 'done') {
            finalAnswer = event.answer || finalAnswer;
            onDone?.(finalAnswer);
          } else if (event.type === 'error') {
            throw new Error(event.message || 'Streaming error');
          }
        } catch (err) {
          throw new Error(`Invalid stream event: ${String(err)}`);
        }
      }

      boundary = buffer.indexOf('\n\n');
    }
  }

  return { receivedAnyToken, finalAnswer };
}

export async function typeOutText(text, onChunk, { minDelay = 6, maxDelay = 16 } = {}) {
  const fullText = text || '';
  for (let i = 0; i < fullText.length; i += 1) {
    onChunk?.(fullText[i]);
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
