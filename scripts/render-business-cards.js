const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const cardsDir = path.join(root, 'public', 'business-cards');

async function render(name) {
  const input = path.join(cardsDir, `${name}.svg`);
  const output = path.join(cardsDir, `${name}.png`);
  let svg = fs.readFileSync(input, 'utf8');
  const accentPath = path.join(root, 'public', 'images', 'brand', 'business-card-accent.png');
  if (fs.existsSync(accentPath)) {
    const accent = fs.readFileSync(accentPath).toString('base64');
    svg = svg.replaceAll('../images/brand/business-card-accent.png', `data:image/png;base64,${accent}`);
  }
  await sharp(Buffer.from(svg), { density: 240 }).png({ quality: 96 }).toFile(output);
  console.log(output);
}

Promise.all([
  render('retail-contract-card-front'),
  render('retail-contract-card-back'),
]).catch((error) => {
  console.error(error);
  process.exit(1);
});
