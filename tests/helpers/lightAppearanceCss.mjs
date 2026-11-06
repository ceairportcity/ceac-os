import {readFileSync} from 'node:fs';
import postcss from 'postcss';
// Resolve only the generated appearance tokens to their actual Light branch.
// This keeps approved-source comparisons exact; the pinned fixture is untouched.
const tokens=new Map();
postcss.parse(readFileSync('src/appearance.css','utf8')).walkDecls(decl=>{
 if(!/^--c\d+$/.test(decl.prop)||!decl.value.startsWith('light-dark('))return;
 const value=decl.value.slice('light-dark('.length);let depth=0;
 for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')')depth--;if(value[i]===','&&depth===0){tokens.set(decl.prop,value.slice(0,i));break;}}
});
export function lightAppearanceCss(css){return css.replace(/var\(--appearance-([\w-]+)/g,'var(--$1').replace(/var\((--c\d+)\)/g,(all,name)=>tokens.get(name)??all);}
