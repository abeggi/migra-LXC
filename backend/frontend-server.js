import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 8080;

app.use(express.static(path.join(__dirname, '../frontend')));

app.listen(port, '0.0.0.0', () => {
    console.log(`Frontend running on http://0.0.0.0:${port}`);
});
