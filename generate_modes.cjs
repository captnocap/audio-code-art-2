const fs = require('fs');
const path = require('path');

const modesDir = '/home/siah/creative/audiocanvaspro/src/modes';
const files = fs.readdirSync(modesDir);

let imports = '';
let mapEntries = '';
let definitions = '';

files.forEach(file => {
    if (file === 'VanillaBase.js' || file === 'Vanilla3DBase.js' || file === 'Constellation.js' || file === 'WormholeMode.js') return;
    if (!file.endsWith('.js')) return;

    const name = path.basename(file, '.js');
    const is3D = name.endsWith('3D');
    const importName = name.replace(/[^a-zA-Z0-9]/g, '') + 'Mode';

    imports += `import ${importName} from '../modes/${name}'\n`;

    if (is3D) {
        mapEntries += `  ${name}: (props) => <Vanilla3DWrapper modeClass={${importName}} {...props} />,\n`;
        definitions += `  ${name}: {\n    name: '${name.replace(/3D$/, ' 3D')}',\n    description: 'Ported 3D mode',\n    params: {}\n  },\n`;
    } else {
        mapEntries += `  ${name}: (props) => <VanillaModeWrapper modeClass={${importName}} {...props} />,\n`;
        definitions += `  ${name}: {\n    name: '${name}',\n    description: 'Ported 2D mode',\n    params: {}\n  },\n`;
    }
});

console.log('// Imports');
console.log(imports);
console.log('// Map Entries');
console.log(mapEntries);
console.log('// Definitions');
console.log(definitions);
