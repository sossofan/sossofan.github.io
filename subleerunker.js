var limit = function(n, min, max) {
  return Math.max(min, Math.min(max, n));
};

var X = 0;
var Y = 1;
var TOP = 0;
var RIGHT = 1;
var BOTTOM = 2;
var LEFT = 3;

var getTexture = function(name) {
  return PIXI.loader.resources['atlas.json'].textures[name];
};

var GameObject = Class.$extend({

  __classvars__: {
    debug: false,
    keys: {
      8: 'backspace', 9: 'tab', 13: 'enter', 16: 'shift', 17: 'ctrl',
      18: 'alt', 19: 'pause', 20: 'capsLock', 27: 'esc', 33: 'pageUp',
      34: 'pageDown', 35: 'end', 36: 'home', 37: 'left', 38: 'up',
      39: 'right', 40: 'down', 45: 'insert', 46: 'delete'
    }
  },

  'class': null,

  __init__: function(parent) {
    this.parent = parent;

    var p = this.padding;
    if (!p) {
      this.padding = [0, 0, 0, 0];
    } else if (p.length === 1) {
      this.padding = [p[0], p[0], p[0], p[0]];
    } else if (p.length === 2) {
      this.padding = [p[0], p[1], p[0], p[1]];
    } else if (p.length === 3) {
      this.padding = [p[0], p[1], p[2], p[1]];
    }

    if (parent) {
      this.jobs = parent.jobs;
      this.jobIndex = parent.jobs.length;
      parent.jobs.push($.proxy(this.update, this));
    } else {
      this.jobs = [];
    }

    if (this.currentAnimationName) {
      this.scene(this.currentAnimationName);
    }

    this.killed = false;
  },

  /* Destruct */

  kill: function() {
    this.killed = true;
  },

  destroy: function() {
    var disp = this.disp();
    if (disp) {
      disp.destroy();
    }
    // this.elem().remove();
    delete this.parent.jobs[this.jobIndex];
  },

  /* DOM */

  width: null,
  height: null,
  padding: null,
  css: null,

  disp: function() {
    // Returns cached a PIXI.DisplayObject.
    var disp = this.__disp__();
    if (disp) {
      this.disp = function() { return disp; };
    }
    return disp;
  },

  __disp__: function() {
    var anim = this.currentAnimation();
    if (!anim || !anim.textureNames) {
      return null;
    }
    var texture = getTexture(anim.textureNames[0]);
    return new PIXI.Sprite(texture);
  },

  // elem: function() {
  //   var css = $.extend({
  //     position: 'absolute',
  //     overflow: 'hidden',
  //     width: this.width,
  //     height: this.height,
  //     padding: this.padding.join('px ') + 'px',
  //     backgroundImage: (this.atlas ? 'url(' + this.atlas + ')' : 'none'),
  //     backgroundRepeat: 'no-repeat',
  //     backgroundPosition: (
  //       -this.atlasPivot[X] + 'px ' + -this.atlasPivot[Y] + 'px'
  //     )
  //   }, this.css);

  //   if (GameObject.debug) {
  //     css.outline = '1px dashed rgba(255, 255, 255, 0.25)';
  //   }

  //   var el = $('<div class="' + this['class'] + '"></div>').css(css);

  //   if (GameObject.debug) {
  //     el.append($('<div></div>').css({
  //       height: '100%',
  //       outline: '1px solid #fff'
  //     }));
  //   }

  //   // Cache the element.
  //   this.elem = function() {
  //     return el;
  //   };
  //   return el;
  // },

  outerWidth: function() {
    return this.width + this.padding[RIGHT] + this.padding[LEFT];
  },

  outerHeight: function() {
    return this.height + this.padding[TOP] + this.padding[BOTTOM];
  },

  /* Animation */

  fps: 60,
  animationSpeed: 1,
  animations: null,
  currentAnimationName: null,

  currentAnimation: function() {
    // console.log([this, this.animations, this.currentAnimationName]);
    if (!this.animations || !this.currentAnimationName) {
      return null;
    }
    return this.animations[this.currentAnimationName] || null;
  },

  // cell: function(x, y) {
  //   x *= -(this.outerWidth() + this.atlasMargin);
  //   y *= -(this.outerHeight() + this.atlasMargin);
  //   x -= this.atlasPivot[X];
  //   y -= this.atlasPivot[Y];
  //   var pos = x + 'px ' + y + 'px';
  //   this.elem().css('background-position', pos);
  // },

  frame: null,

  scene: function(animationName, keepFrame, disp) {
    this.currentAnimationName = animationName;
    if (!keepFrame) {
      this.frame = 0;
    }
  },

  isLastFrame: function() {
    return this.frame >= (this.currentAnimation().textureNames || []).length;
  },

  /* Move */

  position: 0,
  speed: 0,
  duration: 1,
  friction: 1,
  step: 1,

  left: function() {
    this.duration = -1;
    this.forward();
  },

  right: function() {
    this.duration = 1;
    this.forward();
  },

  up: function() {
    this.duration = -1;
    this.forward();
  },

  down: function() {
    this.duration = 1;
    this.forward();
  },

  forward: function() {
    this.speed += this.duration * this.friction;
    this.speed = limit(this.speed, -1, 1);
  },

  rest: function() {
    this.speed = Math.abs(this.speed) - this.friction;
    this.speed = Math.max(0, this.speed) * this.duration;
  },

  updatePosition: function() {
    this.position += this.speed * this.step * this.resist();
  },

  slow: function() {
    return false;
  },

  resist: function() {
    var root = this;
    while (root.parent) {
      root = root.parent;
    }
    return root.slow() ? 0.25 : 1;
  },

  /* Schedule */

  update: function() {
    var self = this;

    if (this.parent === undefined) {
      $.each(this.jobs, function(i, job) {
        if (job !== undefined) {
          job();
          if (self.killed) {
            return false;
          }
        }
      });
      if (this.killed) {
        this.stop();
      }
    } else if (this.killed) {
      this.destroy();
    }

    if (this.killed) {
      return;
    }

    var anim = this.currentAnimation();
    if (anim) {
      var i = Math.floor(this.frame % anim.textureNames.length);
      this.disp().texture = getTexture(anim.textureNames[i]);
      var animationSpeed = anim.animationSpeed || this.animationSpeed;
      this.frame += animationSpeed * this.resist();
    }
  }

  // start: function() {
  //   var delay = 1000 / this.fps;
  //   this.process = setInterval($.proxy(this.update, this), delay);
  // },

  // stop: function() {
  //   clearInterval(this.process);
  //   delete this.process;
  // }

});

var Stage = GameObject.$extend({

  __disp__: function() {
    return new PIXI.Container();
  },

});

var Subleerunker = Stage.$extend({

  'class': 'subleerunker',

  width: 320,
  height: 480 - 2,
  padding: [0, 0, 2, 0],

  leftPrior: true,
  leftPressed: false,
  rightPressed: false,
  shiftPressed: false,
  shiftLocked: false,
  shouldPlay: false,

  atlas: null,  // Don't use atlas.

  __init__: function() {
    this.$super.apply(this, arguments);

    this.css = {
      left: '50%',
      top: '50%',
      marginLeft: this.outerWidth() / -2,
      marginTop: this.outerHeight() / -2,
      outline: '1px solid #222',
      backgroundColor: '#000'
    };

    var m = /my_best_score=(\d+)/.exec(document.cookie);
    this.score = {
      current: 0,
      localBest: m ? m[1] : 0,
      worldBest: 0
    };

    this.updateScore();
    this.reset();
    this.adjustZoom();
  },

  adjustZoom: function() {
    // this.elem().css('zoom', Math.floor(window.innerHeight / this.height));
  },

  // elem: function() {
  //   var el = this.$super();
  //   var score = $('<div class="score"></div>').css({
  //     position: 'absolute',
  //     right: 5,
  //     top: 3,
  //     textAlign: 'right',
  //     color: '#fff',
  //     fontSize: 12,
  //     fontFamily: '"Share Tech Mono", monospace'
  //   }).html([
  //     '<div class="world-best"></div>',
  //     '<div class="local-best"></div>',
  //     '<div class="current"></div>'
  //   ].join(''));
  //   el.append(score);
  //   el.currentScore = score.find('>.current').text(this.score.current);
  //   el.localBestScore = score.find('>.local-best').css('color', '#a6b2b1');
  //   el.highScore = score.find('>.world-best').css('color', '#809190');

  //   // Preload
  //   var preload = $('<div class="preload"></div>').css({
  //     position: 'absolute',
  //     top: -9999,
  //     left: -9999
  //   });
  //   el.append(preload);
  //   var atlases = [];
  //   $.each([Subleerunker.Player, Subleerunker.Flame], function(i, cls) {
  //     if (atlases.indexOf(cls.prototype.atlas) === -1) {
  //       atlases.push(cls.prototype.atlas);
  //     }
  //   });
  //   $.each(atlases, function(i, atlas) {
  //     $('<img />').attr('src', atlas).appendTo(preload);
  //   });

  //   return el;
  // },

  showSplash: function() {
    var Logo = GameObject.$extend({
      'class': 'logo',
      width: 148, height: 66,
      animationSpeed: 0.02,
      animations: {'default': {textureNames: ['logo']}},
      currentAnimationName: 'default',
      css: {top: 156, left: '50%', marginLeft: -74}
    });
    if (typeof window.orientation !== 'undefined') {
      // mobile
      var control = {
        width: 33, height: 35,
        animationTextureNames: ['touch-0', 'touch-1']
      };
    } else {
      // desktop
      var control = {
        width: 65, height: 14,
        animationTextureNames: ['key-0', 'key-1']
      };
    }
    var Control = GameObject.$extend({
      'class': 'control',
      width: control.width,
      height: control.height,
      css: {bottom: 30, left: '50%', marginLeft: -(control.width / 2)},
      animationSpeed: 0.02,
      animations: {'blink': {textureNames: control.animationTextureNames}},
      currentAnimationName: 'blink'
    });
    this.logo = new Logo(this);
    this.control = new Control(this);
    var disp = this.disp();
    disp.addChild(this.logo.disp());
    disp.addChild(this.control.disp());
  },

  hideSplash: function() {
    this.logo.kill();
    this.logo.destroy();
    this.control.kill();
    this.control.destroy();
    delete this.logo, this.control;
  },

  keyEvents: {
    left: function(press) {
      this.leftPressed = press;
      this.leftPrior = true;  // evaluate left first
      if (press) {
        this.shouldPlay = true;
      }
    },
    right: function(press) {
      this.rightPressed = press;
      this.leftPrior = false;  // evaluate right first
      if (press) {
        this.shouldPlay = true;
      }
    },
    shift: function(press, lock) {
      this.shiftPressed = press;
      this.shiftLocked = !!lock;
      if (press && lock) {
        this.shouldPlay = true;
      }
    },
    released: function() {
      this.leftPressed = false;
      this.rightPressed = false;
      this.shiftPressed = false;
      this.shiftLocked = false;
    }
  },

  releaseLockedShift: function() {
    if (this.shiftLocked) {
      this.shiftPressed = false;
      this.shiftLocked = false;
    }
  },

  captureKeys: function(window, document) {
    var self = this;

    $(window).on('keydown', function(e) {
      var handler = self.keyEvents[GameObject.keys[e.which]];
      if ($.isFunction(handler)) {
        handler.call(self, true);
      }
    }).on('keyup', function(e) {
      var handler = self.keyEvents[GameObject.keys[e.which]];
      if ($.isFunction(handler)) {
        handler.call(self, false);
      }
    }).on('blur', function(e) {
      self.keyEvents.released.call(self);
    });

    $(document).on('touchstart touchmove touchend', function(e) {
      e.preventDefault();
      if (e.type == 'touchstart' && e.touches.length == 3) {
        // Toggle shift by 3 fingers.
        self.keyEvents.shift.call(self, !self.shiftPressed, true);
        return;
      }
      var pressLeft = false;
      var pressRight = false;
      if (e.touches.length) {
        var lastTouch = e.touches[e.touches.length - 1];
        if (lastTouch.pageX / window.innerWidth < 0.5) {
          pressLeft = true;
        } else {
          pressRight = true;
        }
      }
      self.keyEvents.left.call(self, pressLeft);
      self.keyEvents.right.call(self, pressRight);
    });

    $(window).on('resize', function(e) {
      self.adjustZoom();
    });
  },

  slow: function() {
    return GameObject.debug && this.shiftPressed;
  },

  reset: function() {
    this.shouldPlay = false;
    this.releaseLockedShift();
    this.showSplash();
  },

  play: function() {
    this.count = 0;
    this.player = new Subleerunker.Player(this);
    if (this.shiftPressed) {
      // Hommarju for SUBERUNKER's shift-enter easter egg.
      this.player.friction *= 0.25;
      this.releaseLockedShift();
    }
    this.disp().addChild(this.player.disp());
    this.score.current = 0;
    this.updateScore();
    this.hideSplash();
  },

  upScore: function() {
    this.score.current++;
    this.updateScore();
  },

  updateScore: function(score) {
    if (score !== undefined) {
      this.score.current = score;
    }
    this.renderLocalBestScore();
    this.renderWorldBestScore();
    // this.elem().currentScore.text(this.score.current);
  },

  renderLocalBestScore: function(score) {
    if (score !== undefined) {
      this.score.localBest = score;
    }
    if (this.score.localBest <= this.score.current) {
      // this.elem().localBestScore.text('');
    } else {
      // this.elem().localBestScore.text(this.score.localBest);
    }
  },

  renderWorldBestScore: function(score) {
    if (score !== undefined) {
      this.score.high = score;
    }

    var greaterThanCurrentScore = this.score.high > this.score.current;
    var greaterThanLocalBestScore = this.score.high > this.score.localBest;

    if (!greaterThanCurrentScore || !greaterThanLocalBestScore) {
      // this.elem().highScore.text('');
    } else {
      // this.elem().highScore.text(this.score.high);
    }
  },

  fetchWorldBest: function() {
    // Not Implemented.
    /*
    $.getJSON('/high-score', $.proxy(function(highScore) {
      this.renderWorldBestScore(highScore);
      if (!this.killed) {
        setTimeout($.proxy(this.fetchWorldBest, this), 10 * 1000);
      }
    }, this));
    */
  },

  challengeWorldBest: function() {
    this.renderWorldBestScore(this.score.current);
    if (GameObject.debug) {
      return;
    }
    // Not Implemented.
    /*
    $.post('/high-score', {
      my_score: this.score.current
    });
    */
  },

  gameOver: function() {
    this.player.die();

    var cookie;
    if (this.score.localBest < this.score.current) {
      // Save local best score in Cookie.
      var expires = new Date();
      expires.setMonth(expires.getMonth() + 1);

      cookie = 'my_best_score=' + this.score.current + '; '
      cookie += 'expires=' + expires.toUTCString() + '; ';
      cookie += 'path=/';
      document.cookie = cookie;

      this.renderLocalBestScore(this.score.current);
    }
    if (this.score.worldBest < this.score.current) {
      this.challengeWorldBest();
    }

    // Trigger custom event to track the score by outside.
    $(window).trigger('score', [this.score.current]);
  },

  update: function() {
    if (!this.player) {
      if (this.shouldPlay) {
        this.play();
        this.shouldPlay = false;
      }
      this.$super();
      return;
    }

    var movements = [[this.leftPressed, this.player.left],
                     [this.rightPressed, this.player.right]];
    for (var i = 0; i < 2; ++i) {
      var mov = movements[this.leftPrior ? i : 1 - i];
      if (mov[0]) {
        mov[1].call(this.player);
        break;
      }
    }
    if (this.leftPressed || this.rightPressed) {
      this.player.forward();
    } else {
      this.player.rest();
    }

    if (!this.player.dead) {
      if ((this.count * this.resist()) % 2 == 0) {
        var difficulty = 0.25 * (1 + (this.count / 1000));
        if (Math.random() < difficulty) {
          var flame = new Subleerunker.Flame(this);
          this.disp().addChild(flame.disp());
        }
      }
    } else {
      var done = true;
      $.each(this.jobs, function(i, job) {
        if (job) {
          done = false;
          return false;
        }
      });
      if (done) {
        delete this.player;
        delete this.jobs;
        this.jobs = [];
        this.reset();
      }
    }

    ++this.count;
    this.$super();
  }

  // start: function() {
  //   this.$super();
  //   this.fetchWorldBest();
  // }
});

$.extend(Subleerunker, {

  Player: GameObject.$extend({

    'class': 'player',

    __init__: function(parent) {
      this.$super.apply(this, arguments);

      this.position = parent.outerWidth() / 2 - this.outerWidth() / 2;
      this.updatePosition();
    },

    update: function() {
      this.$super();

      if (this.dead) {
        if (this.isLastFrame()) {
          this.kill();
        }
      } else if (this.speed) {
        this.updatePosition();
      }
    },

    animationSpeed: 0.2,
    animations: {
      idle: {textureNames: [
        'player-idle-0', 'player-idle-1', 'player-idle-2', 'player-idle-3',
        'player-idle-4', 'player-idle-5', 'player-idle-6'
      ]},
      run: {textureNames: [
        'player-run-0', 'player-run-1', 'player-run-2', 'player-run-3',
        'player-run-4', 'player-run-5', 'player-run-6', 'player-run-7'
      ]},
      die: {textureNames: [
        'player-die-0', 'player-die-1', 'player-die-2', 'player-die-3',
        'player-die-4', 'player-die-5', 'player-die-6', 'player-die-7'
      ]}
    },

    /* DOM */

    width: 12,
    height: 12,
    padding: [10, 18, 50],
    css: {bottom: 0},

    /* Animation */

    atlasMargin: 2,
    animationSpeed: 0.2,
    currentAnimationName: 'idle',

    /* Move */

    speed: 0,
    friction: 0.1,
    step: 5,

    runScene: function(duration) {
      switch (this.currentAnimationName) {
        case 'idle':
          this.frame = 0;
          break;
        case 'run':
          // Inverse same pose.
          if (duration != this.duration) {
            this.frame += 4;
          }
          break;
      }
      var disp = this.disp();
      switch (duration) {
        case -1:
          disp.scale.x = -1;
          disp.anchor.x = 1;
          break;
        case +1:
          disp.scale.x = +1;
          disp.anchor.x = 0;
          break;
      }
      this.scene('run', /* keepFrame */ true);
    },

    left: function() {
      this.$super();
      this.runScene(-1);
    },

    right: function() {
      this.$super();
      this.runScene(+1);
    },

    rest: function() {
      this.$super();
      this.scene('idle', /* keepFrame */true);
    },

    updatePosition: function() {
      this.$super();

      var position = this.position;
      var max = this.parent.outerWidth() - this.outerWidth();
      this.position = limit(this.position, 0, max);

      if (position !== this.position) {
        this.speed = 0;
      }

      this.disp().x = this.position;
      // this.elem().css('left', this.position);
    },

    /* Own */

    die: function() {
      this.dead = true;
      this.speed = 0;
      this.scene('die');
      this.left = this.right = this.forward = this.rest = $.noop;
    }

  }),

  Flame: GameObject.$extend({

    'class': 'flame',

    __init__: function(parent) {
      this.$super.apply(this, arguments);

      var W = parent.outerWidth();
      var w = this.outerWidth();
      this.xPosition = (W - w * 2) * Math.random() + w / 2;
      this.position = -this.outerHeight();
    },

    update: function() {
      this.$super();
      var player = this.parent.player;

      if (this.landed) {
        if (this.isLastFrame()) {
          this.destroy();
          if (!player.dead) {
            this.parent.upScore();
          }
        }
      } else {
        this.forward();
        this.updatePosition();

        var max = this.parent.height - this.outerHeight();
        var min = this.parent.height - player.outerHeight();

        if (this.position > max) {
          this.position = max;
          this.speed = 0;
          this.updatePosition();
          this.scene('land');
          this.landed = true;
        } else if (this.position < min) {
          return;
        }

        if (!player.dead && this.hit(player)) {
          this.destroy();
          this.parent.gameOver();
        }
      }
    },

    /* DOM */

    width: 6,
    height: 6,
    padding: [8, 8, 2],

    /* Animation */

    atlasPivot: [150, 370],
    atlasMargin: 2,
    animations: {
      burn: {
        animationSpeed: 0.2,
        textureNames: [
          'flame-burn-0', 'flame-burn-1', 'flame-burn-2', 'flame-burn-3',
          'flame-burn-4', 'flame-burn-5', 'flame-burn-6'
        ]
      },
      land: {
        animationSpeed: 0.4,
        textureNames: [
          'flame-land-0', 'flame-land-1', 'flame-land-2'
        ]
      }
    },
    currentAnimationName: 'burn',

    /* Move */

    speed: 0,
    friction: 0.01,
    step: 10,

    updatePosition: function() {
      this.$super();

      var disp = this.disp();
      if (disp) {
        disp.x = this.xPosition;
        disp.y = this.position;
      }
      // this.elem().css({
      //   left: this.xPosition,
      //   top: this.position
      // });
    },

    /* Own */

    hit: function(player) {
      var prevPosition = this.position - this.speed * this.step;
      var H = this.parent.outerHeight();

      var top = prevPosition + this.padding[TOP];
      var bottom = this.position + this.outerHeight() - this.padding[2];
      var left = this.xPosition + this.padding[3];
      var right = left + this.width;

      var pTop = player.outerHeight() - player.padding[0];
      var pBottom = player.padding[2];
      var pLeft = player.position + player.padding[3];
      var pRight = pLeft + player.width;

      pTop = H - pTop;
      pBottom = H - pBottom;

      var checkAltitude = top <= pBottom && pTop <= bottom;
      var checkLeft = pLeft <= left && left <= pRight;
      var checkRight = pLeft <= right && right <= pRight;

      return checkAltitude && (checkLeft || checkRight);
    }

  })

});
