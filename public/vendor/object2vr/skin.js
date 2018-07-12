// Garden Gnome Software - Skin
// Object2VR 3.1.5/10768
// Filename: SMG-skin.ggsk
// Generated Thu Jul 12 15:32:01 2018

function object2vrSkin (player, base) {
  var me = this;
  var flag = false;
  var nodeMarker = new Array();
  var activeNodeMarker = new Array();
  this.player = player;
  this.player.skinObj = this;
  this.divSkin = player.divSkin;
  var basePath = '';
  // auto detect base path
  if (base == '?') {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src.indexOf('skin.js') >= 0) {
        var p = src.lastIndexOf('/');
        if (p >= 0) {
          basePath = src.substr(0, p + 1);
        }
      }
    }
  } else if (base) {
    basePath = base;
  }
  this.elementMouseDown = new Array();
  this.elementMouseOver = new Array();
  var cssPrefix = '';
  var domTransition = 'transition';
  var domTransform = 'transform';
  var prefixes = 'Webkit,Moz,O,ms,Ms'.split(',');
  var i;
  for (i = 0; i < prefixes.length; i++) {
    if (typeof document.body.style[prefixes[i] + 'Transform'] !== 'undefined') {
      cssPrefix = '-' + prefixes[i].toLowerCase() + '-';
      domTransition = prefixes[i] + 'Transition';
      domTransform = prefixes[i] + 'Transform';
    }
  }

  this.player.setMargins(0, 0, 0, 0);

  this.updateSize = function (startElement) {
    var stack = new Array();
    stack.push(startElement);
    while (stack.length > 0) {
      var e = stack.pop();
      if (e.ggUpdatePosition) {
        e.ggUpdatePosition();
      }
      if (e.hasChildNodes()) {
        for (i = 0; i < e.childNodes.length; i++) {
          stack.push(e.childNodes[i]);
        }
      }
    }
  };

  parameterToTransform = function (p) {
    var hs =
      'translate(' +
      p.rx +
      'px,' +
      p.ry +
      'px) rotate(' +
      p.a +
      'deg) scale(' +
      p.sx +
      ',' +
      p.sy +
      ')';
    return hs;
  };

  this.findElements = function (id, regex) {
    var r = new Array();
    var stack = new Array();
    var pat = new RegExp(id, '');
    stack.push(me.divSkin);
    while (stack.length > 0) {
      var e = stack.pop();
      if (regex) {
        if (pat.test(e.ggId)) r.push(e);
      } else {
        if (e.ggId == id) r.push(e);
      }
      if (e.hasChildNodes()) {
        for (i = 0; i < e.childNodes.length; i++) {
          stack.push(e.childNodes[i]);
        }
      }
    }
    return r;
  };

  this.addSkin = function () {
    this._controller = document.createElement('div');
    this._controller.ggId = 'controller';
    this._controller.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._controller.ggVisible = true;
    this._controller.className = 'ggskin ggskin_container';
    this._controller.ggType = 'container';
    this._controller.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      if (this.parentNode) {
        var w = this.parentNode.offsetWidth;
        this.style.left = Math.floor(-320 + w / 2) + 'px';
        var h = this.parentNode.offsetHeight;
        this.style.top = Math.floor(-480 + h) + 'px';
      }
    };
    hs = 'position:absolute;';
    hs += 'left: -320px;';
    hs += 'top:  -480px;';
    hs += 'width: 640px;';
    hs += 'height: 480px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'visibility: inherit;';
    this._controller.setAttribute('style', hs);
    this._controller.onmouseover = function () {
      me._controller.style[domTransition] = 'none';
      me._controller.style.opacity = '1';
      me._controller.style.visibility = me._controller.ggVisible
        ? 'inherit'
        : 'hidden';
    };
    this._controller.onmouseout = function () {
      me._controller.style[domTransition] = 'none';
      me._controller.style.opacity = '0.1';
      me._controller.style.visibility = me._controller.ggVisible
        ? 'inherit'
        : 'hidden';
    };
    this._toolbarbggrad = document.createElement('div');
    this._toolbarbggrad.ggId = 'toolbar-bg-grad';
    this._toolbarbggrad.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._toolbarbggrad.ggVisible = true;
    this._toolbarbggrad.className = 'ggskin ggskin_image';
    this._toolbarbggrad.ggType = 'image';
    this._toolbarbggrad.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      if (this.parentNode) {
        var w = this.parentNode.offsetWidth;
        this.style.left = Math.floor(-1096 + w / 2) + 'px';
        var h = this.parentNode.offsetHeight;
        this.style.top = Math.floor(-33 + h) + 'px';
      }
    };
    hs = 'position:absolute;';
    hs += 'left: -1096px;';
    hs += 'top:  -33px;';
    hs += 'width: 1600px;';
    hs += 'height: 48px;';
    hs += cssPrefix + 'transform-origin: 50% 100%;';
    hs += 'visibility: inherit;';
    this._toolbarbggrad.setAttribute('style', hs);
    this._toolbarbggrad__img = document.createElement('img');
    this._toolbarbggrad__img.className = 'ggskin ggskin_image';
    this._toolbarbggrad__img.setAttribute(
      'src',
      basePath + '/toolbarbggrad.png'
    );
    this._toolbarbggrad__img.setAttribute(
      'style',
      'position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;'
    );
    this._toolbarbggrad__img.className = 'ggskin ggskin_image';
    this._toolbarbggrad__img['ondragstart'] = function () {
      return false;
    };
    me.player.checkLoaded.push(this._toolbarbggrad__img);
    this._toolbarbggrad.appendChild(this._toolbarbggrad__img);
    this._controller.appendChild(this._toolbarbggrad);
    this._left = document.createElement('div');
    this._left.ggId = 'left';
    this._left.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._left.ggVisible = true;
    this._left.className = 'ggskin ggskin_svg';
    this._left.ggType = 'svg';
    this._left.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      if (this.parentNode) {
        var w = this.parentNode.offsetWidth;
        this.style.left = Math.floor(-156 + w / 2) + 'px';
        var h = this.parentNode.offsetHeight;
        this.style.top = Math.floor(-48 + h) + 'px';
      }
    };
    hs = 'position:absolute;';
    hs += 'left: -156px;';
    hs += 'top:  -48px;';
    hs += 'width: 48px;';
    hs += 'height: 48px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0.75;';
    hs += 'visibility: inherit;';
    hs += 'cursor: pointer;';
    this._left.setAttribute('style', hs);
    this._left__img = document.createElement('img');
    this._left__img.className = 'ggskin ggskin_svg';
    this._left__img.setAttribute('src', basePath + '/left.svg');
    this._left__img.setAttribute(
      'style',
      'position: absolute;top: 0px;left: 0px;width: 48px;height: 48px;-webkit-user-drag:none;'
    );
    this._left__img['ondragstart'] = function () {
      return false;
    };
    this._left.appendChild(this._left__img);
    this._left.onmouseover = function () {
      me.elementMouseOver['left'] = true;
    };
    this._left.onmouseout = function () {
      if (me.player.transitionsDisabled) {
        me._left.style[domTransition] = 'none';
      } else {
        me._left.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._left.style.opacity = '0.75';
      me._left.style.visibility = me._left.ggVisible ? 'inherit' : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_left.style[domTransition] = 'none';
      } else {
        me._t_left.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_left.style.opacity = '0';
      me._t_left.style.visibility = 'hidden';
      me.elementMouseOver['left'] = false;
    };
    this._left.onmousedown = function () {
      me.player.changePanLog(1, true);
    };
    this._left.ontouchend = function () {
      me.elementMouseOver['left'] = false;
    };
    this._t_left = document.createElement('div');
    this._t_left__text = document.createElement('div');
    this._t_left.className = 'ggskin ggskin_textdiv';
    this._t_left.ggTextDiv = this._t_left__text;
    this._t_left.ggId = 't_left';
    this._t_left.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._t_left.ggVisible = true;
    this._t_left.className = 'ggskin ggskin_text';
    this._t_left.ggType = 'text';
    this._t_left.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      if (this.parentNode) {
        var w = this.parentNode.offsetWidth;
        this.style.left = Math.floor(-36 + w / 2) + 'px';
        var h = this.parentNode.offsetHeight;
        this.style.top = Math.floor(-66 + h) + 'px';
      }
    };
    hs = 'position:absolute;';
    hs += 'left: -36px;';
    hs += 'top:  -66px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0;';
    hs += 'visibility: hidden;';
    this._t_left.setAttribute('style', hs);
    hs = 'position:absolute;';
    hs += 'left: 0px;';
    hs += 'top:  0px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += 'background: #000000;';
    hs += 'background: rgba(0,0,0,0.823529);';
    hs += 'border: 0px solid #000000;';
    hs += 'border-radius: 4px;';
    hs += cssPrefix + 'border-radius: 4px;';
    hs += 'color: #ffffff;';
    hs += 'text-align: center;';
    hs += 'white-space: nowrap;';
    hs += 'padding: 1px 2px 1px 2px;';
    hs += 'overflow: hidden;';
    this._t_left__text.setAttribute('style', hs);
    this._t_left.ggTextDiv.innerHTML = 'Rotate left';
    this._t_left.appendChild(this._t_left__text);
    this._left.appendChild(this._t_left);
    this._controller.appendChild(this._left);
    this._right = document.createElement('div');
    this._right.ggId = 'right';
    this._right.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._right.ggVisible = true;
    this._right.className = 'ggskin ggskin_svg';
    this._right.ggType = 'svg';
    hs = 'position:absolute;';
    hs += 'left: 212px;';
    hs += 'top:  432px;';
    hs += 'width: 48px;';
    hs += 'height: 48px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0.75;';
    hs += 'visibility: inherit;';
    hs += 'cursor: pointer;';
    this._right.setAttribute('style', hs);
    this._right__img = document.createElement('img');
    this._right__img.className = 'ggskin ggskin_svg';
    this._right__img.setAttribute('src', basePath + '/right.svg');
    this._right__img.setAttribute(
      'style',
      'position: absolute;top: 0px;left: 0px;width: 48px;height: 48px;-webkit-user-drag:none;'
    );
    this._right__img['ondragstart'] = function () {
      return false;
    };
    this._right.appendChild(this._right__img);
    this._right.onmouseover = function () {
      me.elementMouseOver['right'] = true;
    };
    this._right.onmouseout = function () {
      if (me.player.transitionsDisabled) {
        me._right.style[domTransition] = 'none';
      } else {
        me._right.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._right.style.opacity = '0.75';
      me._right.style.visibility = me._right.ggVisible ? 'inherit' : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_right.style[domTransition] = 'none';
      } else {
        me._t_right.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_right.style.opacity = '0';
      me._t_right.style.visibility = 'hidden';
      me.elementMouseOver['right'] = false;
    };
    this._right.onmousedown = function () {
      me.player.changePanLog(-1, true);
    };
    this._right.ontouchend = function () {
      me.elementMouseOver['right'] = false;
    };
    this._t_right = document.createElement('div');
    this._t_right__text = document.createElement('div');
    this._t_right.className = 'ggskin ggskin_textdiv';
    this._t_right.ggTextDiv = this._t_right__text;
    this._t_right.ggId = 't_right';
    this._t_right.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._t_right.ggVisible = true;
    this._t_right.className = 'ggskin ggskin_text';
    this._t_right.ggType = 'text';
    this._t_right.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      if (this.parentNode) {
        var w = this.parentNode.offsetWidth;
        this.style.left = Math.floor(-36 + w / 2) + 'px';
        var h = this.parentNode.offsetHeight;
        this.style.top = Math.floor(-66 + h) + 'px';
      }
    };
    hs = 'position:absolute;';
    hs += 'left: -36px;';
    hs += 'top:  -66px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0;';
    hs += 'visibility: hidden;';
    this._t_right.setAttribute('style', hs);
    hs = 'position:absolute;';
    hs += 'left: 0px;';
    hs += 'top:  0px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += 'background: #000000;';
    hs += 'background: rgba(0,0,0,0.823529);';
    hs += 'border: 0px solid #000000;';
    hs += 'border-radius: 4px;';
    hs += cssPrefix + 'border-radius: 4px;';
    hs += 'color: #ffffff;';
    hs += 'text-align: center;';
    hs += 'white-space: nowrap;';
    hs += 'padding: 1px 2px 1px 2px;';
    hs += 'overflow: hidden;';
    this._t_right__text.setAttribute('style', hs);
    this._t_right.ggTextDiv.innerHTML = 'Rotate right';
    this._t_right.appendChild(this._t_right__text);
    this._right.appendChild(this._t_right);
    this._controller.appendChild(this._right);
    this._zoomin = document.createElement('div');
    this._zoomin.ggId = 'zoomin';
    this._zoomin.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._zoomin.ggVisible = true;
    this._zoomin.className = 'ggskin ggskin_svg';
    this._zoomin.ggType = 'svg';
    hs = 'position:absolute;';
    hs += 'left: 272px;';
    hs += 'top:  432px;';
    hs += 'width: 48px;';
    hs += 'height: 48px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0.75;';
    hs += 'visibility: inherit;';
    hs += 'cursor: pointer;';
    this._zoomin.setAttribute('style', hs);
    this._zoomin__img = document.createElement('img');
    this._zoomin__img.className = 'ggskin ggskin_svg';
    this._zoomin__img.setAttribute('src', basePath + '/zoomin.svg');
    this._zoomin__img.setAttribute(
      'style',
      'position: absolute;top: 0px;left: 0px;width: 48px;height: 48px;-webkit-user-drag:none;'
    );
    this._zoomin__img['ondragstart'] = function () {
      return false;
    };
    this._zoomin.appendChild(this._zoomin__img);
    this._zoomin.onmouseover = function () {
      if (me.player.transitionsDisabled) {
        me._zoomin.style[domTransition] = 'none';
      } else {
        me._zoomin.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._zoomin.style.opacity = '1';
      me._zoomin.style.visibility = me._zoomin.ggVisible ? 'inherit' : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_zoomin.style[domTransition] = 'none';
      } else {
        me._t_zoomin.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_zoomin.style.opacity = '1';
      me._t_zoomin.style.visibility = me._t_zoomin.ggVisible
        ? 'inherit'
        : 'hidden';
    };
    this._zoomin.onmouseout = function () {
      if (me.player.transitionsDisabled) {
        me._zoomin.style[domTransition] = 'none';
      } else {
        me._zoomin.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._zoomin.style.opacity = '0.75';
      me._zoomin.style.visibility = me._zoomin.ggVisible ? 'inherit' : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_zoomin.style[domTransition] = 'none';
      } else {
        me._t_zoomin.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_zoomin.style.opacity = '0';
      me._t_zoomin.style.visibility = 'hidden';
      me.elementMouseDown['zoomin'] = false;
    };
    this._zoomin.onmousedown = function () {
      me.elementMouseDown['zoomin'] = true;
    };
    this._zoomin.onmouseup = function () {
      me.elementMouseDown['zoomin'] = false;
    };
    this._zoomin.ontouchend = function () {
      me.elementMouseDown['zoomin'] = false;
    };
    this._t_zoomin = document.createElement('div');
    this._t_zoomin__text = document.createElement('div');
    this._t_zoomin.className = 'ggskin ggskin_textdiv';
    this._t_zoomin.ggTextDiv = this._t_zoomin__text;
    this._t_zoomin.ggId = 't_zoomin';
    this._t_zoomin.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._t_zoomin.ggVisible = true;
    this._t_zoomin.className = 'ggskin ggskin_text';
    this._t_zoomin.ggType = 'text';
    this._t_zoomin.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      if (this.parentNode) {
        var w = this.parentNode.offsetWidth;
        this.style.left = Math.floor(-36 + w / 2) + 'px';
        var h = this.parentNode.offsetHeight;
        this.style.top = Math.floor(-66 + h) + 'px';
      }
    };
    hs = 'position:absolute;';
    hs += 'left: -36px;';
    hs += 'top:  -66px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0;';
    hs += 'visibility: hidden;';
    this._t_zoomin.setAttribute('style', hs);
    hs = 'position:absolute;';
    hs += 'left: 0px;';
    hs += 'top:  0px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += 'background: #000000;';
    hs += 'background: rgba(0,0,0,0.823529);';
    hs += 'border: 0px solid #000000;';
    hs += 'border-radius: 4px;';
    hs += cssPrefix + 'border-radius: 4px;';
    hs += 'color: #ffffff;';
    hs += 'text-align: center;';
    hs += 'white-space: nowrap;';
    hs += 'padding: 1px 2px 1px 2px;';
    hs += 'overflow: hidden;';
    this._t_zoomin__text.setAttribute('style', hs);
    this._t_zoomin.ggTextDiv.innerHTML = 'Zoom in';
    this._t_zoomin.appendChild(this._t_zoomin__text);
    this._zoomin.appendChild(this._t_zoomin);
    this._controller.appendChild(this._zoomin);
    this._zoomout = document.createElement('div');
    this._zoomout.ggId = 'zoomout';
    this._zoomout.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._zoomout.ggVisible = true;
    this._zoomout.className = 'ggskin ggskin_svg';
    this._zoomout.ggType = 'svg';
    hs = 'position:absolute;';
    hs += 'left: 320px;';
    hs += 'top:  432px;';
    hs += 'width: 48px;';
    hs += 'height: 48px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0.75;';
    hs += 'visibility: inherit;';
    hs += 'cursor: pointer;';
    this._zoomout.setAttribute('style', hs);
    this._zoomout__img = document.createElement('img');
    this._zoomout__img.className = 'ggskin ggskin_svg';
    this._zoomout__img.setAttribute('src', basePath + '/zoomout.svg');
    this._zoomout__img.setAttribute(
      'style',
      'position: absolute;top: 0px;left: 0px;width: 48px;height: 48px;-webkit-user-drag:none;'
    );
    this._zoomout__img['ondragstart'] = function () {
      return false;
    };
    this._zoomout.appendChild(this._zoomout__img);
    this._zoomout.onmouseover = function () {
      if (me.player.transitionsDisabled) {
        me._zoomout.style[domTransition] = 'none';
      } else {
        me._zoomout.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._zoomout.style.opacity = '1';
      me._zoomout.style.visibility = me._zoomout.ggVisible
        ? 'inherit'
        : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_zoomout.style[domTransition] = 'none';
      } else {
        me._t_zoomout.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_zoomout.style.opacity = '1';
      me._t_zoomout.style.visibility = me._t_zoomout.ggVisible
        ? 'inherit'
        : 'hidden';
    };
    this._zoomout.onmouseout = function () {
      if (me.player.transitionsDisabled) {
        me._zoomout.style[domTransition] = 'none';
      } else {
        me._zoomout.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._zoomout.style.opacity = '0.75';
      me._zoomout.style.visibility = me._zoomout.ggVisible
        ? 'inherit'
        : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_zoomout.style[domTransition] = 'none';
      } else {
        me._t_zoomout.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_zoomout.style.opacity = '0';
      me._t_zoomout.style.visibility = 'hidden';
      me.elementMouseDown['zoomout'] = false;
    };
    this._zoomout.onmousedown = function () {
      me.elementMouseDown['zoomout'] = true;
    };
    this._zoomout.onmouseup = function () {
      me.elementMouseDown['zoomout'] = false;
    };
    this._zoomout.ontouchend = function () {
      me.elementMouseDown['zoomout'] = false;
    };
    this._t_zoomout = document.createElement('div');
    this._t_zoomout__text = document.createElement('div');
    this._t_zoomout.className = 'ggskin ggskin_textdiv';
    this._t_zoomout.ggTextDiv = this._t_zoomout__text;
    this._t_zoomout.ggId = 't_zoomout';
    this._t_zoomout.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._t_zoomout.ggVisible = true;
    this._t_zoomout.className = 'ggskin ggskin_text';
    this._t_zoomout.ggType = 'text';
    this._t_zoomout.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      if (this.parentNode) {
        var w = this.parentNode.offsetWidth;
        this.style.left = Math.floor(-36 + w / 2) + 'px';
        var h = this.parentNode.offsetHeight;
        this.style.top = Math.floor(-66 + h) + 'px';
      }
    };
    hs = 'position:absolute;';
    hs += 'left: -36px;';
    hs += 'top:  -66px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0;';
    hs += 'visibility: hidden;';
    this._t_zoomout.setAttribute('style', hs);
    hs = 'position:absolute;';
    hs += 'left: 0px;';
    hs += 'top:  0px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += 'background: #000000;';
    hs += 'background: rgba(0,0,0,0.823529);';
    hs += 'border: 0px solid #000000;';
    hs += 'border-radius: 4px;';
    hs += cssPrefix + 'border-radius: 4px;';
    hs += 'color: #ffffff;';
    hs += 'text-align: center;';
    hs += 'white-space: nowrap;';
    hs += 'padding: 1px 2px 1px 2px;';
    hs += 'overflow: hidden;';
    this._t_zoomout__text.setAttribute('style', hs);
    this._t_zoomout.ggTextDiv.innerHTML = 'Zoom out';
    this._t_zoomout.appendChild(this._t_zoomout__text);
    this._zoomout.appendChild(this._t_zoomout);
    this._controller.appendChild(this._zoomout);
    this._autorotate = document.createElement('div');
    this._autorotate.ggId = 'autorotate';
    this._autorotate.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._autorotate.ggVisible = true;
    this._autorotate.className = 'ggskin ggskin_svg';
    this._autorotate.ggType = 'svg';
    hs = 'position:absolute;';
    hs += 'left: 380px;';
    hs += 'top:  432px;';
    hs += 'width: 48px;';
    hs += 'height: 48px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0.75;';
    hs += 'visibility: inherit;';
    hs += 'cursor: pointer;';
    this._autorotate.setAttribute('style', hs);
    this._autorotate__img = document.createElement('img');
    this._autorotate__img.className = 'ggskin ggskin_svg';
    this._autorotate__img.setAttribute('src', basePath + '/autorotate.svg');
    this._autorotate__img.setAttribute(
      'style',
      'position: absolute;top: 0px;left: 0px;width: 48px;height: 48px;-webkit-user-drag:none;'
    );
    this._autorotate__img['ondragstart'] = function () {
      return false;
    };
    this._autorotate.appendChild(this._autorotate__img);
    this._autorotate.onclick = function () {
      me.player.toggleAutorotate();
    };
    this._autorotate.onmouseover = function () {
      if (me.player.transitionsDisabled) {
        me._autorotate.style[domTransition] = 'none';
      } else {
        me._autorotate.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._autorotate.style.opacity = '1';
      me._autorotate.style.visibility = me._autorotate.ggVisible
        ? 'inherit'
        : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_autorotate.style[domTransition] = 'none';
      } else {
        me._t_autorotate.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_autorotate.style.opacity = '1';
      me._t_autorotate.style.visibility = me._t_autorotate.ggVisible
        ? 'inherit'
        : 'hidden';
    };
    this._autorotate.onmouseout = function () {
      if (me.player.transitionsDisabled) {
        me._autorotate.style[domTransition] = 'none';
      } else {
        me._autorotate.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._autorotate.style.opacity = '0.75';
      me._autorotate.style.visibility = me._autorotate.ggVisible
        ? 'inherit'
        : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_autorotate.style[domTransition] = 'none';
      } else {
        me._t_autorotate.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_autorotate.style.opacity = '0';
      me._t_autorotate.style.visibility = 'hidden';
    };
    this._t_autorotate = document.createElement('div');
    this._t_autorotate__text = document.createElement('div');
    this._t_autorotate.className = 'ggskin ggskin_textdiv';
    this._t_autorotate.ggTextDiv = this._t_autorotate__text;
    this._t_autorotate.ggId = 't_autorotate';
    this._t_autorotate.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._t_autorotate.ggVisible = true;
    this._t_autorotate.className = 'ggskin ggskin_text';
    this._t_autorotate.ggType = 'text';
    this._t_autorotate.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      if (this.parentNode) {
        var w = this.parentNode.offsetWidth;
        this.style.left = Math.floor(-32 + w / 2) + 'px';
        var h = this.parentNode.offsetHeight;
        this.style.top = Math.floor(-66 + h) + 'px';
      }
    };
    hs = 'position:absolute;';
    hs += 'left: -32px;';
    hs += 'top:  -66px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0;';
    hs += 'visibility: hidden;';
    this._t_autorotate.setAttribute('style', hs);
    hs = 'position:absolute;';
    hs += 'left: 0px;';
    hs += 'top:  0px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += 'background: #000000;';
    hs += 'background: rgba(0,0,0,0.823529);';
    hs += 'border: 0px solid #000000;';
    hs += 'border-radius: 4px;';
    hs += cssPrefix + 'border-radius: 4px;';
    hs += 'color: #ffffff;';
    hs += 'text-align: center;';
    hs += 'white-space: nowrap;';
    hs += 'padding: 1px 2px 1px 2px;';
    hs += 'overflow: hidden;';
    this._t_autorotate__text.setAttribute('style', hs);
    this._t_autorotate.ggTextDiv.innerHTML = 'Auto spin';
    this._t_autorotate.appendChild(this._t_autorotate__text);
    this._autorotate.appendChild(this._t_autorotate);
    this._controller.appendChild(this._autorotate);
    this._fullscreen = document.createElement('div');
    this._fullscreen.ggId = 'fullscreen';
    this._fullscreen.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._fullscreen.ggVisible = true;
    this._fullscreen.className = 'ggskin ggskin_svg';
    this._fullscreen.ggType = 'svg';
    hs = 'position:absolute;';
    hs += 'left: 428px;';
    hs += 'top:  432px;';
    hs += 'width: 48px;';
    hs += 'height: 48px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0.75;';
    hs += 'visibility: inherit;';
    hs += 'cursor: pointer;';
    this._fullscreen.setAttribute('style', hs);
    this._fullscreen__img = document.createElement('img');
    this._fullscreen__img.className = 'ggskin ggskin_svg';
    this._fullscreen__img.setAttribute('src', basePath + '/fullscreen.svg');
    this._fullscreen__img.setAttribute(
      'style',
      'position: absolute;top: 0px;left: 0px;width: 48px;height: 48px;-webkit-user-drag:none;'
    );
    this._fullscreen__img['ondragstart'] = function () {
      return false;
    };
    this._fullscreen.appendChild(this._fullscreen__img);
    this._fullscreen.onclick = function () {
      me.player.toggleFullscreen();
    };
    this._fullscreen.onmouseover = function () {
      if (me.player.transitionsDisabled) {
        me._fullscreen.style[domTransition] = 'none';
      } else {
        me._fullscreen.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._fullscreen.style.opacity = '1';
      me._fullscreen.style.visibility = me._fullscreen.ggVisible
        ? 'inherit'
        : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_fullscreen.style[domTransition] = 'none';
      } else {
        me._t_fullscreen.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_fullscreen.style.opacity = '1';
      me._t_fullscreen.style.visibility = me._t_fullscreen.ggVisible
        ? 'inherit'
        : 'hidden';
    };
    this._fullscreen.onmouseout = function () {
      if (me.player.transitionsDisabled) {
        me._fullscreen.style[domTransition] = 'none';
      } else {
        me._fullscreen.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._fullscreen.style.opacity = '0.75';
      me._fullscreen.style.visibility = me._fullscreen.ggVisible
        ? 'inherit'
        : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_fullscreen.style[domTransition] = 'none';
      } else {
        me._t_fullscreen.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_fullscreen.style.opacity = '0';
      me._t_fullscreen.style.visibility = 'hidden';
    };
    this._t_fullscreen = document.createElement('div');
    this._t_fullscreen__text = document.createElement('div');
    this._t_fullscreen.className = 'ggskin ggskin_textdiv';
    this._t_fullscreen.ggTextDiv = this._t_fullscreen__text;
    this._t_fullscreen.ggId = 't_fullscreen';
    this._t_fullscreen.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._t_fullscreen.ggVisible = true;
    this._t_fullscreen.className = 'ggskin ggskin_text';
    this._t_fullscreen.ggType = 'text';
    this._t_fullscreen.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      if (this.parentNode) {
        var w = this.parentNode.offsetWidth;
        this.style.left = Math.floor(-32 + w / 2) + 'px';
        var h = this.parentNode.offsetHeight;
        this.style.top = Math.floor(-66 + h) + 'px';
      }
    };
    hs = 'position:absolute;';
    hs += 'left: -32px;';
    hs += 'top:  -66px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0;';
    hs += 'visibility: hidden;';
    this._t_fullscreen.setAttribute('style', hs);
    hs = 'position:absolute;';
    hs += 'left: 0px;';
    hs += 'top:  0px;';
    hs += 'width: 68px;';
    hs += 'height: 16px;';
    hs += 'background: #000000;';
    hs += 'background: rgba(0,0,0,0.823529);';
    hs += 'border: 0px solid #000000;';
    hs += 'border-radius: 4px;';
    hs += cssPrefix + 'border-radius: 4px;';
    hs += 'color: #ffffff;';
    hs += 'text-align: center;';
    hs += 'white-space: nowrap;';
    hs += 'padding: 1px 2px 1px 2px;';
    hs += 'overflow: hidden;';
    this._t_fullscreen__text.setAttribute('style', hs);
    this._t_fullscreen.ggTextDiv.innerHTML = 'Full screen';
    this._t_fullscreen.appendChild(this._t_fullscreen__text);
    this._fullscreen.appendChild(this._t_fullscreen);
    this._controller.appendChild(this._fullscreen);
    this.divSkin.appendChild(this._controller);
    this._loading = document.createElement('div');
    this._loading.ggId = 'loading';
    this._loading.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._loading.ggVisible = true;
    this._loading.className = 'ggskin ggskin_container';
    this._loading.ggType = 'container';
    this._loading.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      if (this.parentNode) {
        var w = this.parentNode.offsetWidth;
        this.style.left = Math.floor(-105 + w / 2) + 'px';
        var h = this.parentNode.offsetHeight;
        this.style.top = Math.floor(-30 + h / 2) + 'px';
      }
    };
    hs = 'position:absolute;';
    hs += 'left: -105px;';
    hs += 'top:  -30px;';
    hs += 'width: 210px;';
    hs += 'height: 60px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'visibility: inherit;';
    this._loading.setAttribute('style', hs);
    this._loading.onclick = function () {
      me._loading.style[domTransition] = 'none';
      me._loading.style.visibility = 'hidden';
      me._loading.ggVisible = false;
    };
    this._loadingbg = document.createElement('div');
    this._loadingbg.ggId = 'loadingbg';
    this._loadingbg.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._loadingbg.ggVisible = true;
    this._loadingbg.className = 'ggskin ggskin_rectangle';
    this._loadingbg.ggType = 'rectangle';
    hs = 'position:absolute;';
    hs += 'left: 0px;';
    hs += 'top:  0px;';
    hs += 'width: 209px;';
    hs += 'height: 59px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'opacity: 0.5;';
    hs += 'visibility: inherit;';
    hs += 'background: #000000;';
    hs += 'background: rgba(0,0,0,0.870588);';
    hs += 'border: 1px solid #ffffff;';
    this._loadingbg.setAttribute('style', hs);
    this._loading.appendChild(this._loadingbg);
    this._loadingtext = document.createElement('div');
    this._loadingtext__text = document.createElement('div');
    this._loadingtext.className = 'ggskin ggskin_textdiv';
    this._loadingtext.ggTextDiv = this._loadingtext__text;
    this._loadingtext.ggId = 'loadingtext';
    this._loadingtext.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._loadingtext.ggVisible = true;
    this._loadingtext.className = 'ggskin ggskin_text';
    this._loadingtext.ggType = 'text';
    this._loadingtext.ggUpdatePosition = function () {
      this.style[domTransition] = 'none';
      this.ggTextDiv.style.left =
        Math.floor(0 + (176 - this.ggTextDiv.offsetWidth) / 2) + 'px';
    };
    hs = 'position:absolute;';
    hs += 'left: 17px;';
    hs += 'top:  12px;';
    hs += 'width: 176px;';
    hs += 'height: 23px;';
    hs += cssPrefix + 'transform-origin: 50% 50%;';
    hs += 'visibility: inherit;';
    this._loadingtext.setAttribute('style', hs);
    hs = 'position:absolute;';
    hs += 'left: 0px;';
    hs += 'top:  0px;';
    hs += 'width: auto;';
    hs += 'height: auto;';
    hs += 'border: 0px solid #000000;';
    hs += 'color: #ffffff;';
    hs += 'text-align: left;';
    hs += 'white-space: nowrap;';
    hs += 'padding: 0px 1px 0px 1px;';
    hs += 'overflow: hidden;';
    this._loadingtext__text.setAttribute('style', hs);
    this._loadingtext.ggUpdateText = function () {
      var hs =
        'Loading... ' + (me.player.getPercentLoaded() * 100.0).toFixed(0) + '%';
      if (hs != this.ggText) {
        this.ggText = hs;
        this.ggTextDiv.innerHTML = hs;
      }
      this.ggUpdatePosition();
    };
    this._loadingtext.ggUpdateText();
    this._loadingtext.appendChild(this._loadingtext__text);
    this._loading.appendChild(this._loadingtext);
    this._loadingbar = document.createElement('div');
    this._loadingbar.ggId = 'loadingbar';
    this._loadingbar.ggParameter = { rx: 0, ry: 0, a: 0, sx: 1, sy: 1 };
    this._loadingbar.ggVisible = true;
    this._loadingbar.className = 'ggskin ggskin_rectangle';
    this._loadingbar.ggType = 'rectangle';
    hs = 'position:absolute;';
    hs += 'left: 15px;';
    hs += 'top:  35px;';
    hs += 'width: 182px;';
    hs += 'height: 8px;';
    hs += cssPrefix + 'transform-origin: 0% 50%;';
    hs += 'visibility: inherit;';
    hs += 'background: #ffffff;';
    hs += 'border: 0px solid #808080;';
    hs += 'border-radius: 4px;';
    hs += cssPrefix + 'border-radius: 4px;';
    this._loadingbar.setAttribute('style', hs);
    this._loading.appendChild(this._loadingbar);
    this.divSkin.appendChild(this._loading);
    this.divSkin.ggUpdateSize = function (w, h) {
      me.updateSize(me.divSkin);
    };
    this.divSkin.ggViewerInit = function () {};
    this.divSkin.ggLoaded = function () {
      me._loading.style[domTransition] = 'none';
      me._loading.style.visibility = 'hidden';
      me._loading.ggVisible = false;
    };
    this.divSkin.ggReLoaded = function () {
      me._loading.style[domTransition] = 'none';
      me._loading.style.visibility = 'inherit';
      me._loading.ggVisible = true;
    };
    this.divSkin.ggLoadedLevels = function () {};
    this.divSkin.ggReLoadedLevels = function () {};
    this.divSkin.ggEnterFullscreen = function () {};
    this.divSkin.ggExitFullscreen = function () {};
    this.skinTimerEvent();
  };
  this.hotspotProxyClick = function (id) {};
  this.hotspotProxyOver = function (id) {};
  this.hotspotProxyOut = function (id) {};
  this.changeActiveNode = function (id) {
    var newMarker = new Array();
    var i, j;
    var tags = me.player.userdata.tags;
    for (i = 0; i < nodeMarker.length; i++) {
      var match = false;
      if (nodeMarker[i].ggMarkerNodeId == id && id != '') match = true;
      for (j = 0; j < tags.length; j++) {
        if (nodeMarker[i].ggMarkerNodeId == tags[j]) match = true;
      }
      if (match) {
        newMarker.push(nodeMarker[i]);
      }
    }
    for (i = 0; i < activeNodeMarker.length; i++) {
      if (newMarker.indexOf(activeNodeMarker[i]) < 0) {
        if (activeNodeMarker[i].ggMarkerNormal) {
          activeNodeMarker[i].ggMarkerNormal.style.visibility = 'inherit';
        }
        if (activeNodeMarker[i].ggMarkerActive) {
          activeNodeMarker[i].ggMarkerActive.style.visibility = 'hidden';
        }
        if (activeNodeMarker[i].ggDeactivate) {
          activeNodeMarker[i].ggDeactivate();
        }
      }
    }
    for (i = 0; i < newMarker.length; i++) {
      if (activeNodeMarker.indexOf(newMarker[i]) < 0) {
        if (newMarker[i].ggMarkerNormal) {
          newMarker[i].ggMarkerNormal.style.visibility = 'hidden';
        }
        if (newMarker[i].ggMarkerActive) {
          newMarker[i].ggMarkerActive.style.visibility = 'inherit';
        }
        if (newMarker[i].ggActivate) {
          newMarker[i].ggActivate();
        }
      }
    }
    activeNodeMarker = newMarker;
  };
  this.skinTimerEvent = function () {
    setTimeout(function () {
      me.skinTimerEvent();
    }, 10);
    if (me.elementMouseOver['left']) {
      if (me.player.transitionsDisabled) {
        me._left.style[domTransition] = 'none';
      } else {
        me._left.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._left.style.opacity = '1';
      me._left.style.visibility = me._left.ggVisible ? 'inherit' : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_left.style[domTransition] = 'none';
      } else {
        me._t_left.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_left.style.opacity = '1';
      me._t_left.style.visibility = me._t_left.ggVisible ? 'inherit' : 'hidden';
    }
    if (me.elementMouseOver['right']) {
      if (me.player.transitionsDisabled) {
        me._right.style[domTransition] = 'none';
      } else {
        me._right.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._right.style.opacity = '1';
      me._right.style.visibility = me._right.ggVisible ? 'inherit' : 'hidden';
      if (me.player.transitionsDisabled) {
        me._t_right.style[domTransition] = 'none';
      } else {
        me._t_right.style[domTransition] = 'all 500ms ease-out 0ms';
      }
      me._t_right.style.opacity = '1';
      me._t_right.style.visibility = me._t_right.ggVisible
        ? 'inherit'
        : 'hidden';
    }
    if (me.elementMouseDown['zoomin']) {
      me.player.changeFovLog(-1, true);
    }
    if (me.elementMouseDown['zoomout']) {
      me.player.changeFovLog(1, true);
    }
    this._loadingtext.ggUpdateText();
    var hs = '';
    if (me._loadingbar.ggParameter) {
      hs += parameterToTransform(me._loadingbar.ggParameter) + ' ';
    }
    hs += 'scale(' + (1 * me.player.getPercentLoaded() + 0) + ',1.0) ';
    me._loadingbar.style[domTransform] = hs;
  };
  this.addSkin();
}
