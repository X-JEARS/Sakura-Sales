import fs from 'node:fs';

const sourceDir = new URL('../node_modules/antd-mobile-icons/es/', import.meta.url);
const iconSources = {
  x: 'CloseOutline', plus: 'AddOutline', minus: 'MinusOutline', menu: 'UnorderedListOutline',
  calendar: 'CalendarOutline', settings: 'SetOutline', users: 'TeamOutline', sliders: 'SetOutline',
  sun: 'SetOutline', moon: 'SetOutline', chart: 'HistogramOutline', edit: 'EditSOutline',
  list: 'UnorderedListOutline', package: 'ShopbagOutline', image: 'PictureOutline',
  arrowRight: 'RightOutline', arrowLeft: 'LeftOutline', upload: 'UploadOutline'
};

const sourceIcons = {};
for (const source of new Set(Object.values(iconSources))) {
  const file = new URL(`${source}.js`, sourceDir);
  const sourceCode = fs.readFileSync(file, 'utf8');
  const paths = [...sourceCode.matchAll(/React\.createElement\("path",\s*\{[\s\S]*?d:\s*"([^"]+)"/g)]
    .map(match => `<path d="${match[1]}"/>`).join('');
  sourceIcons[source] = { viewBox: '0 0 48 48', body: paths };
}

const aliases = Object.fromEntries(Object.entries(iconSources).map(([name, source]) => [name, `S.${source}`]));
const output = `/* Generated from antd-mobile-icons@0.3.0. Do not edit manually. */\nconst S = ${JSON.stringify(sourceIcons)};\nwindow.ANTD_ICONS = ${JSON.stringify(aliases).replace(/"S\.([A-Za-z]+)"/g, 'S.$1')};\n`;
fs.writeFileSync(new URL('../public/antd-icons.js', import.meta.url), output);
