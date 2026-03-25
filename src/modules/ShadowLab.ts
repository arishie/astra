import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export class ShadowLab {
    private sandboxDir: string = 'sandbox_temp';

    constructor() {
        if (!fs.existsSync(this.sandboxDir)) {
            fs.mkdirSync(this.sandboxDir);
        }
    }

    /**
     * Executes code in a simulated isolated environment.
     * In a production environment, this would run `docker run -v ... node:alpine ...`
     * For this local demo, we use a separate process with a timeout.
     */
    public async verifyCode(code: string, language: 'javascript' | 'python'): Promise<{ success: boolean, output: string }> {
        const id = uuidv4();
        let filename = '';
        let cmd = '';
        let args: string[] = [];

        if (language === 'javascript') {
            filename = path.join(this.sandboxDir, `test_${id}.js`);
            cmd = 'node';
            args = [filename];
        } else if (language === 'python') {
            filename = path.join(this.sandboxDir, `test_${id}.py`);
            cmd = 'python3';
            args = [filename];
        } else {
            return { success: false, output: "Unsupported language" };
        }

        fs.writeFileSync(filename, code);
        console.log(`[ShadowLab] 🧪 Verifying code in sandbox: ${filename}`);

        return new Promise((resolve) => {
            const process = spawn(cmd, args, {
                timeout: 5000 // 5 second strict timeout
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => stdout += data.toString());
            process.stderr.on('data', (data) => stderr += data.toString());

            process.on('close', (code) => {
                // Cleanup
                try { fs.unlinkSync(filename); } catch {}

                if (code === 0) {
                    console.log(`[ShadowLab] ✅ Verification Passed.`);
                    resolve({ success: true, output: stdout });
                } else {
                    console.warn(`[ShadowLab] ❌ Verification Failed.`);
                    resolve({ success: false, output: stderr || stdout || "Process failed" });
                }
            });

            process.on('error', (err) => {
                resolve({ success: false, output: `Execution Error: ${err.message}` });
            });
        });
    }
}
