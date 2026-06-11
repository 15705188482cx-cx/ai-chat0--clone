const fs = require('fs');
let s = fs.readFileSync('preview_chat.html', 'utf8');

// Fix: The issue is \' inside JS strings. In the source file,
// the literal backslash followed by single quote \' appears as \\' in the string.
// We need to find these patterns and fix them.

// Pattern 1: onclick handlers with function args like openChat(\'id\',\'name\')
// In the file these appear as: onclick=\"openChat(\\''+id+'\\')\"
// The \' closes the JS string! Fix: use \" instead.

// Strategy: In the entire JS section, \' inside a string literal
// that's meant to produce a ' in HTML output should become \x27 or we should restructure.
//
// Simplest fix: replace ALL instances of \' in the JS that are causing issues.
// Since we're inside <script>, \' in a JS string is just a regular ' character.
// The actual file has the literal characters: backslash single-quote.
//
// Let me just directly search and replace the problematic patterns.

const scriptStart = s.indexOf('<script>') + 8;
const scriptEnd = s.indexOf('</script>');
const js = s.substring(scriptStart, scriptEnd);

// Remove &quot; from previous bad replacement
let fixed = js.replace(/&quot;/g, "''");

// Replace \' (literal backslash-singlequote) with regular '.
// In the file, the characters are literally: \ then '
// When Node reads this, it sees \\' which is different.
// Let's check what the actual bytes are.
const idx = fixed.indexOf("onclick");
if (idx >= 0) {
  const sample = fixed.substring(idx, idx + 80);
  console.log('Sample onclick:', JSON.stringify(sample));
}

// Find all \' patterns (backslash followed by quote that ends a string)
// These appear as: \\'  in the raw text
// We want to replace them with just ' for HTML double-quoted attrs
let count = 0;
fixed = fixed.replace(/\\'/g, function() { count++; return "'"; });
console.log('Replaced', count, 'instances of \\\'');

s = s.substring(0, scriptStart) + fixed + s.substring(scriptEnd);
fs.writeFileSync('preview_chat.html', s);

// Verify
const m = s.match(/<script>([\s\S]*?)<\/script>/);
fs.writeFileSync('_verify.js', m[1]);
try {
  new Function(m[1]);
  console.log('JS OK');
} catch(e) {
  console.log('JS ERROR:', e.message.slice(0, 100));
}
