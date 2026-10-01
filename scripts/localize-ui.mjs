// Mechanical source migration: React localization components, no DOM mutation.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
const inventory = new Set();
const files = [];
function walk(dir) { for (const entry of fs.readdirSync(dir,{withFileTypes:true})) { const file=path.join(dir,entry.name); if(entry.isDirectory()) walk(file); else if(file.endsWith('.tsx')) files.push(file); } }
walk('src/app'); walk('src/components');
const attrNames = new Set(['placeholder','title','aria-label','alt']);
for (const file of files) {
  if (file.endsWith('locale-provider.tsx') || file.endsWith('layout.tsx')) continue;
  let source=fs.readFileSync(file,'utf8');
  if (source.includes('// locale-wired')) continue;
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const edits=[]; let needsText=false; let needsElement=false;
  function visit(node) {
    if(ts.isJsxText(node)) {
      const raw=node.getText(ast); const value=raw.replace(/\s+/g,' ').replaceAll('&amp;','&').replaceAll('&apos;',"'").replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&quot;','"');
      if(/[A-Za-z]{2}/.test(value)) { inventory.add(value); edits.push([node.pos,node.end,`<UiText text=${JSON.stringify(value)} />`]); needsText=true; }
      return;
    }
    if(ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent) && node.expression) {
      const expression=node.expression;
      if (ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression) || ts.isConditionalExpression(expression) || ts.isBinaryExpression(expression) || ts.isTemplateExpression(expression)) {
        // Do not wrap expressions containing JSX; their descendants are handled separately.
        let hasJsx=false;
        function check(n){if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)||ts.isJsxFragment(n))hasJsx=true;ts.forEachChild(n,check);}
        check(expression);
        const code=expression.getText(ast);
        const userData=/\b(ev|actor|author|subsystem|row|item|primary|iteration|test|decision|n|a|note|event|selected|focus)\b/.test(code);
        if(!hasJsx && !userData && code !== 'children') { edits.push([node.getStart(ast),node.end,`<UiText text={${code}} />`]);needsText=true; return; }
      }
    }
    if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)) {
      const tag=node.tagName.getText(ast);
      for(const attr of node.attributes.properties) if(ts.isJsxAttribute(attr) && attr.initializer && ts.isStringLiteral(attr.initializer) && ['title','subtitle','body','label','hint',...attrNames].includes(attr.name.getText(ast))) inventory.add(attr.initializer.text);
      if(/^[a-z][a-z0-9-]*$/.test(tag) && node.attributes.properties.some((a)=>ts.isJsxAttribute(a)&&attrNames.has(a.name.getText(ast)))) {
        edits.push([node.tagName.getStart(ast),node.tagName.end,`UiElement as="${tag}"`]);needsElement=true;
        if(ts.isJsxOpeningElement(node)&&ts.isJsxElement(node.parent)) edits.push([node.parent.closingElement.tagName.getStart(ast),node.parent.closingElement.tagName.end,'UiElement']);
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);
  if(process.argv.includes('--apply') && edits.length){
    for(const [start,end,value] of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,start)+value+source.slice(end);
    const names=[needsText && !source.includes('import { UiText }')?'UiText':null,needsElement?'UiElement':null].filter(Boolean);
    const imports=`// locale-wired\n${names.length ? `import { ${names.join(', ')} } from "@/components/locale-provider";\n` : ''}`;
    const directive=/^(["']use client["'];?\s*)/.exec(source);
    const offset=directive?directive[0].length:0;
    source=source.slice(0,offset)+imports+source.slice(offset);
    fs.writeFileSync(file,source);
  }
}
console.log(JSON.stringify([...inventory].sort(),null,2));
