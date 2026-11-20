import { pipeline, env } from "https://unpkg.com";

env.backends.onnx.wasm.wasmPaths = "https://unpkg.com";

let generator = null;

self.onmessage = async function(e) {
    const { id, systemPrompt, userPrompt, senderName } = e.data;
    try {
        if (!generator) {
            generator = await pipeline(
                "text-generation",
                "HuggingFaceTB/SmolLM2-135M-Instruct",
                { dtype: "q4", device: "wasm" }
            );
        }
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: senderName + " says: " + userPrompt }
        ];
        const output = await generator(messages, {
            max_new_tokens: 45,
            temperature: 0.8
        });
        const generated = output && output.generated_text;
        const reply = Array.isArray(generated)
            ? generated[generated.length - 1].content
            : String(generated || "");
        self.postMessage({ id, reply: reply.trim().slice(0, 195) });
    } catch (err) {
        self.postMessage({ id, error: String(err) });
    }
};
