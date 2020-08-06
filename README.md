# CodeMirror Minimap

Add minimap support to [CodeMirror](http://codemirror.net/).

## install

```npm
npm install codemirror-minimap
```

## how to use

```
import 'codemirror-minimap';
import 'codemirror-minimap/src/minimap.css';


const editor = CodeMirror.fromTextArea(document.getElementById("code"), {
  minimap: true,
  // or minimap: { scale: 6 }
});
```

