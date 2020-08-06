# CodeMirror Minimap

Add minimap support to [CodeMirror](http://codemirror.net/).

## Screenshot

![](https://github.com/wlwywlqk/codemirror-minimap/blob/master/images/screenshot.png?raw=true "screenshot")

## Install

```npm
npm install codemirror-minimap
```

## How to use

```javascript
import 'codemirror-minimap';
import 'codemirror-minimap/src/minimap.css';


const editor = CodeMirror.fromTextArea(document.getElementById('code'), {
  minimap: true,
  // or minimap: { scale: 6 }
});
```

