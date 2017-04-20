#!/usr/bin/env babel-node --presets=es2017 --plugins=transform-object-rest-spread

// This script will fill in the subPath for zips from GitHub. 
//
// It should be run from the root of a cook-book folder.
// i.e. adjacent to "recipes"

const fs = require('fs');

const glob = pattern => new Promise((resolve, reject) => require('glob')(pattern, (e, d) => {
  if (e) {
    reject(e);
  } else {
    resolve(d);
  }
}));

const readRecipe = path => new Promise((resolve, reject) => {
  fs.readFile(path, 'utf8', (e, d) => {
    if (e) {
      reject(e);
    } else {
      resolve(JSON.parse(d));
    }
  });
});

const writeFile = (path, content) => new Promise((resolve, reject) => {
  fs.writeFile(path, content, e => {
    if (e) {
      reject(e);
    } else {
      resolve();
    }
  })
});

const fixVersion = async (version) => {
  if (!version.source || !version.source.url || version.source.subPath || !version.source.url.startsWith('https://github.com/')) {
    return version;
  }
  const project = version.source.url.split('/')[4];
  const commit = version.source.url.split('/').slice(-1)[0].slice(0, -4);
  const subPath = project + '-' + commit;
  return {
    ...version,
    source: {
      ...version.source,
      subPath,
    }
  };
};

const fixRecipe = async (recipe) => {
  let result = {...recipe};
  const entries = Object.entries(recipe.versions);
  for (const entry of entries) {
    result.versions[entry[0]] = await fixVersion(entry[1]);
  }
  return result;
};

async function main() {
  const files = await glob('recipes/*/*.json');
  const recipes = await Promise.all(files.map(async (x) => {
    const recipe = await readRecipe(x);
    return {
      path: x,
      data: await fixRecipe(recipe)
    };
  }));
  for (const recipe of recipes) {
    console.log('Writing ' + recipe.path + '... ');
    await writeFile(recipe.path, JSON.stringify(recipe.data, null, 2));
  }
  console.log('Done!');
}

main();
