import { Command } from 'commander';
import { readFileSync } from 'fs';
import { render } from './index.js';
import type { Charset } from './core/types.js';

const program = new Command();

program
  .name('mermaid2term')
  .description('Render Mermaid diagrams as ASCII art in the terminal')
  .version('0.1.0')
  .argument('[file]', 'Mermaid file to render (use - for stdin)')
  .option('-a, --ascii', 'Use ASCII-only characters instead of Unicode', false)
  .option('-w, --width <number>', 'Maximum output width (0=unlimited, -1=auto-detect terminal)', '0')
  .option('-l, --max-label <number>', 'Maximum label width before truncation (0=unlimited)', '0')
  .option('-x, --padding-x <number>', 'Horizontal spacing between nodes', '5')
  .option('-y, --padding-y <number>', 'Vertical spacing between nodes', '5')
  .option('-p, --border-padding <number>', 'Padding inside node borders', '1')
  .option('--compact', 'Compact mode - minimal spacing for narrow terminals', false)
  .option('-c, --coords', 'Show coordinate debug overlay', false)
  .action(async (file: string | undefined, opts) => {
    try {
      let input: string;
      
      if (!file || file === '-') {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        input = Buffer.concat(chunks).toString('utf-8');
      } else {
        input = readFileSync(file, 'utf-8');
      }
      
      if (!input.trim()) {
        console.error('Error: Empty input');
        process.exit(1);
      }
      
      const output = render(input, {
        charset: opts.ascii ? 'ascii' : 'unicode' as Charset,
        maxWidth: parseInt(opts.width, 10),
        maxLabelWidth: parseInt(opts.maxLabel, 10),
        paddingX: parseInt(opts.paddingX, 10),
        paddingY: parseInt(opts.paddingY, 10),
        borderPadding: parseInt(opts.borderPadding, 10),
        compact: opts.compact,
        showCoords: opts.coords,
      });
      
      console.log(output);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('An unknown error occurred');
      }
      process.exit(1);
    }
  });

program.parse();
