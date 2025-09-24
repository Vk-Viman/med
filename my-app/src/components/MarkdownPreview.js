import React from 'react';
import { Text } from 'react-native';

// Supports **bold** and *italic* only (nested bold inside italic not deeply handled)
export default function MarkdownPreview({ text, style }) {
  if(!text) return <Text style={[{ color:'#607D8B', fontStyle:'italic' }, style]}>Nothing to preview</Text>;
  const safe = text.replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const boldSplit = safe.split(/(\*\*[^*]+\*\*)/g);
  const rendered = boldSplit.map((chunk,i)=>{
    if(/\*\*[^*]+\*\*/.test(chunk)){
      const inner = chunk.slice(2,-2);
      return <Text key={i} style={{ fontWeight:'700' }}>{inner}</Text>;
    }
    const italicSplit = chunk.split(/(\*[^*]+\*)/g).map((c,j)=>{
      if(/\*[^*]+\*/.test(c)){
        return <Text key={j} style={{ fontStyle:'italic' }}>{c.slice(1,-1)}</Text>;
      }
      return <Text key={j}>{c}</Text>;
    });
    return <Text key={i}>{italicSplit}</Text>;
  });
  return <Text selectable style={[{ color:'#01579B' }, style]}>{rendered}</Text>;
}
