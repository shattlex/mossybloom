const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = process.cwd();
const contentRootCandidates = [
  path.join(root, 'Mossy Bloom контент', 'Mossy Bloom контент'),
  path.join(root, 'Mossy Bloom контент-20260420T174730Z-3-001', 'Mossy Bloom контент')
];
const publicRosesRoot = path.join(root, 'public', 'products', 'roses');
const publicPreviewsRoot = path.join(root, 'public', 'products', 'previews');
const publicConstructorRoot = path.join(root, 'public', 'products', 'constructor');
const publicConstructorPreviewsRoot = path.join(root, 'public', 'products', 'constructor-previews');
const outFile = path.join(root, 'src', 'app', 'data', 'generatedContentMedia.ts');
const dataTsPath = path.join(root, 'src', 'app', 'data.ts');

const SIZE_KEYS = ['S', 'M', 'L'];

function resolveContentRoot() {
  return contentRootCandidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^букет\s+/i, '')
    .replace(/["«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function translitSlug(s) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k',
    л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
  };
  return String(s || '')
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function pickSubfolder(baseDir, key) {
  if (!fs.existsSync(baseDir)) return null;
  const dirs = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (key === 'S') {
    return dirs.find((d) => /^21\s*4/i.test(d)) || dirs.find((d) => /^21$/i.test(d));
  }
  if (key === 'M') {
    return dirs.find((d) => /^51$/i.test(d));
  }
  if (key === 'L') {
    return dirs.find((d) => /^101$/i.test(d));
  }
  if (key === 'ONE') {
    return dirs.find((d) => /^1$/i.test(d));
  }
  return null;
}

function firstNImages(dir, n = 3) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .slice(0, n)
    .map((f) => path.join(dir, f));
}

async function convertToWebp(src, dst, { width, quality = 82 } = {}) {
  const pipeline = sharp(src).rotate();
  if (Number(width) > 0) {
    pipeline.resize({ width, withoutEnlargement: true });
  }
  await pipeline.webp({ quality }).toFile(dst);
}

async function copySizeImages(productId, sizeKey, files) {
  const targetDir = path.join(publicRosesRoot, productId, 'sizes', sizeKey);
  ensureDir(targetDir);

  const out = [];
  for (let i = 0; i < files.length; i += 1) {
    const targetName = `${i + 1}.webp`;
    const targetPath = path.join(targetDir, targetName);
    await convertToWebp(files[i], targetPath, { quality: 84 });
    out.push(`/products/roses/${productId}/sizes/${sizeKey}/${targetName}`);
  }
  return out;
}

async function writeMainGalleryImages(productId, files) {
  const targetDir = path.join(publicRosesRoot, productId);
  ensureDir(targetDir);
  const out = [];
  for (let i = 0; i < files.length; i += 1) {
    const targetName = `${i + 1}.webp`;
    const targetPath = path.join(targetDir, targetName);
    await convertToWebp(files[i], targetPath, { quality: 86 });
    out.push(`/products/roses/${productId}/${targetName}`);
  }
  return out;
}

async function writeProductPreview(productId, src) {
  ensureDir(publicPreviewsRoot);
  const targetPath = path.join(publicPreviewsRoot, `${productId}.webp`);
  await convertToWebp(src, targetPath, { width: 520, quality: 72 });
  return `/products/previews/${productId}.webp`;
}

async function writeConstructorImages(slug, files) {
  const fullDir = path.join(publicConstructorRoot, slug);
  const previewDir = path.join(publicConstructorPreviewsRoot, slug);
  ensureDir(fullDir);
  ensureDir(previewDir);

  const full = [];
  for (let i = 0; i < files.length; i += 1) {
    const name = `${i + 1}.webp`;
    const fullPath = path.join(fullDir, name);
    const previewPath = path.join(previewDir, name);

    await convertToWebp(files[i], fullPath, { quality: 84 });
    await convertToWebp(files[i], previewPath, { width: 420, quality: 70 });

    full.push(`/products/constructor/${slug}/${name}`);
  }
  return full;
}

function parseProductsFromDataTs(dataTs) {
  const productRegex = /\{\s*id:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"[\s\S]*?\}/g;
  const products = [];
  for (const m of dataTs.matchAll(productRegex)) {
    const id = m[1];
    const title = m[2];
    if (!id.startsWith('rose-')) continue;
    products.push({ id, title });
  }
  return products;
}

async function main() {
  const contentRoot = resolveContentRoot();
  if (!contentRoot) {
    throw new Error(`Content folder not found. Checked: ${contentRootCandidates.join(' | ')}`);
  }

  const dataTs = fs.readFileSync(dataTsPath, 'utf8');
  const products = parseProductsFromDataTs(dataTs);

  const contentFolders = fs
    .readdirSync(contentRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const folderByNormName = new Map(contentFolders.map((name) => [normalizeName(name), name]));

  const mediaMap = {};
  const constructorFlowers = [];
  const missingByProduct = [];

  for (const p of products) {
    const folder = folderByNormName.get(normalizeName(p.title));
    if (!folder) {
      missingByProduct.push(`${p.id} (${p.title}) -> folder not found`);
      continue;
    }

    const folderPath = path.join(contentRoot, folder);
    const sizes = { S: [], M: [], L: [] };
    const sourceBySize = {};

    for (const sizeKey of SIZE_KEYS) {
      const sub = pickSubfolder(folderPath, sizeKey);
      if (!sub) {
        missingByProduct.push(`${p.id} (${p.title}) -> size ${sizeKey} folder missing`);
        continue;
      }
      const files = firstNImages(path.join(folderPath, sub), 3);
      if (files.length < 3) {
        missingByProduct.push(`${p.id} (${p.title}) -> size ${sizeKey} has ${files.length}/3 images`);
        continue;
      }
      sourceBySize[sizeKey] = files;
      sizes[sizeKey] = await copySizeImages(p.id, sizeKey, files);
    }

    const mainSource = sourceBySize.S || sourceBySize.M || sourceBySize.L;
    if (mainSource && mainSource.length >= 3) {
      await writeMainGalleryImages(p.id, mainSource);
      await writeProductPreview(p.id, mainSource[0]);
    }

    mediaMap[p.id] = { title: p.title, folder, sizes };

    const oneDir = pickSubfolder(folderPath, 'ONE');
    const oneFiles = oneDir ? firstNImages(path.join(folderPath, oneDir), 3) : [];
    if (oneFiles.length > 0) {
      const constructorSlug = translitSlug(folder);
      const copied = await writeConstructorImages(constructorSlug, oneFiles);
      constructorFlowers.push({
        id: `constructor-${p.id}`,
        name: folder,
        image: copied[0],
        images: copied
      });
    }
  }

  const out = `/* AUTO-GENERATED by scripts/generate-content-media.cjs. Do not edit manually. */\n\nexport type ProductSizeKey = 'S' | 'M' | 'L';\n\nexport interface GeneratedProductMedia {\n  title: string;\n  folder: string;\n  sizes: Record<ProductSizeKey, string[]>;\n}\n\nexport const generatedProductMedia: Record<string, GeneratedProductMedia> = ${JSON.stringify(mediaMap, null, 2)};\n\nexport interface ConstructorFlowerAsset {\n  id: string;\n  name: string;\n  image: string;\n  images: string[];\n}\n\nexport const generatedConstructorFlowers: ConstructorFlowerAsset[] = ${JSON.stringify(constructorFlowers, null, 2)};\n`;

  fs.writeFileSync(outFile, out, 'utf8');

  console.log(`Content root: ${contentRoot}`);
  console.log(`Generated ${outFile}`);
  console.log(`Products with media: ${Object.keys(mediaMap).length}`);
  console.log(`Constructor items: ${constructorFlowers.length}`);
  if (missingByProduct.length > 0) {
    console.log('Missing media report:');
    missingByProduct.forEach((line) => console.log(`- ${line}`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
