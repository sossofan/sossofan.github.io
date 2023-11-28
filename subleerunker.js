var IS_MOBILE   = 'ontouchstart' in document.documentElement;
var FONT_FAMILY = '"Share Tech Mono", monospace';

var LEFT_PRESSED  = 0;
var RIGHT_PRESSED = 1;
var RIGHT_PRIOR   = 2;

var makeRandomSeed = function() {
  return Math.floor(Math.random() * 4294967295);
};

var rgb = function(color) {
  return '#' + ('000000' + color.toString(16)).slice(-6);
};

var Subleerunker = Game.$extend({

  __name__: 'Subleerunker',

  'class': 'subleerunker',

  width: 320,
  height: 480,
  atlas: 'atlas.json',

  difficulty: 0.25,

  setup: function() {
    // Set background color.
    this.renderer.backgroundColor = this.pickColor('background');

    // Reset game state.
    this.reset();

    // Init scores.
    this.scores = {
      current: 0,
      prime: Number(
        // Fallback with deprecated cookie names.
        // cookies.get('prime-score') ||
        // cookies.get('best-score') ||
        // cookies.get('my_best_score') ||
      0),
      champion: {
        score: null,
        name: null,
        token: null,
        authorized: false
      }
    };

    // Render scores.
    this.setupHUD();
    this.renderScores();
    this.loadChampion();
  },

  setupHUD: function() {
    var $$ = $('<div class="scores">').css({
      position: 'absolute',
      right: 5,
      top: 3,
      textAlign: 'right',
      fontSize: 12,
      fontFamily: FONT_FAMILY,
      cursor: 'default'
    }).appendTo(this.hudElem());

    var nameStyle = {
      display: 'inline',
      textAlign: 'right',
      fontSize: 12,
      fontFamily: FONT_FAMILY,
      backgroundColor: 'transparent',
      width: '4ex',
      border: 'none',
      outline: 'none',
      borderRadius: 0,
      padding: 0,
      margin: 0,
      marginRight: '0.5ex',
      textTransform: 'uppercase'
    };

    $$ // Here's a jQuery chain to build HUD.

    .html([
      '<form class="authorized-champion">',
        '<label>',
          '<input class="name" name="name" maxlength="3" tabindex="0" />',
          '<span class="score"></span>',
        '</label>',
      '</form>',
      '<div class="champion">',
        '<input class="name" readonly />',
        '<span class="score"></span>',
      '</div>',
      '<div class="prime"></div>',
      '<div class="current"></div>'
    ].join(''))

    .find('>.authorized-champion')
      .css('color', rgb(this.pickColor('authorized-champion')))
      .find('.name')
        .css(nameStyle)
        .css('color', rgb(this.pickColor('authorized-champion')))
        .on('focus', function() { $(this).select(); })
      .end()
      .hide()
    .end()

    .find('>.champion')
      .css('color', rgb(this.pickColor('champion')))
      .find('.name')
        .css(nameStyle)
        .css('color', rgb(this.pickColor('champion')))
        .css('user-select', 'none')
      .end()
      .hide()
    .end()

    .find('>.prime')
      .css('color', rgb(this.pickColor('prime')))
    .end()

    .find('>.current')
      .css('color', rgb(this.pickColor('current')))
    .end()

    ; // End of HUD building.

    // Cache elements for fast access.
    var $$$ = {
      authorizedChampion: {
        container: $$.find('>.authorized-champion'),
        name: $$.find('>.authorized-champion .name'),
        score: $$.find('>.authorized-champion .score')
      },
      champion: {
        container: $$.find('>.champion'),
        name: $$.find('>.champion .name'),
        score: $$.find('>.champion .score')
      },
      prime: $$.find('>.prime'),
      current: $$.find('>.current')
    };
    this.recordElems = $$$;

    // Champion renaming events.
    var inSubmit = false;
    $$$.authorizedChampion.container.on('submit', $.proxy(function(e) {
      e.preventDefault();
      this.renameChampion($$$.authorizedChampion.name.val());
      inSubmit = true;
      $$$.authorizedChampion.name.blur();
      inSubmit = false;
    }, this));
    $$$.authorizedChampion.name.on('blur', $.proxy(function() {
      if (!inSubmit) {
        $$$.authorizedChampion.container.submit();
      }
    }));

    // Prevent useless input mode in mobile.
    $$$.champion.name.on('focus', function(e) {
      e.preventDefault();
      $$$.champion.name.blur();
    });
  },

  hudElem: function() {
    var elem = this.elem();
    var hudElem = elem.find('>.ui:eq(0)');
    if (!hudElem.length) {
      hudElem = $('<div class="hud">').css({
        position: 'absolute', top: 0, left: 0,
        margin: 0, padding: 0,
        // "100%" makes a layout bug on IE11.
        width: this.width, height: this.height
      });
      elem.append(hudElem);
    }
    this.hudElem = function() { return hudElem; }
    return hudElem;
  },

  zoom: function(scale) {
    this.$super.apply(this, arguments);
    this.hudElem().css('zoom', scale);
  },

  showSplash: function() {
    var Logo = GameObject.$extend({
      width: 148, height: 66,
      anchor: [0.5, 0],
      offset: [this.width / 2, 156],
      anims: {
        'default': {fps: 0, textureNames: ['logo']}
      },
      animName: 'default',
    });
    this.logo = new Logo(this);

    var control = {};
    if (IS_MOBILE) {
      $.extend(control, {
        width: 33, height: 35, animTextureNames: ['touch-0', 'touch-1']
      });
    } else {
      $.extend(control, {
        width: 65, height: 14, animTextureNames: ['key-0', 'key-1']
      });
    }
    var Control = GameObject.$extend({
      width: control.width,
      height: control.height,
      anchor: [0.5, 1],
      offset: [this.width / 2, -31],
      anims: {
        'blink': {fps: 1, textureNames: control.animTextureNames}
      },
      animName: 'blink'
    });
    this.control = new Control(this);

    var disp = this.disp();
    disp.addChild(this.logo.disp());
    disp.addChild(this.control.disp());
  },

  hideSplash: function() {
    this.logo.destroy();
    this.control.destroy();
    delete this.logo, this.control;
  },

  isPlaying: function() {
    return Boolean(this.player);
  },

  setInputBit: function(offset, value) {
    // bits = bits & ~(1 << n) | (x << n); for change the n-th bit to x.
    // See also: https://stackoverflow.com/questions/47981
    this.input = this.input & ~(1 << offset) | ((value ? 1 : 0) << offset);
  },

  getInputBit: function(offset) {
    return Boolean(this.input & (1 << offset));
  },

  handlers: {
    keyLeft: function(press) {
      this.setInputBit(LEFT_PRESSED, press);
      this.setInputBit(RIGHT_PRIOR, false);
      if (press && !this.isPlaying()) {
        this.shouldPlay = true;
      }
    },
    keyRight: function(press) {
      this.setInputBit(RIGHT_PRESSED, press);
      this.setInputBit(RIGHT_PRIOR, true);
      if (press && !this.isPlaying()) {
        this.shouldPlay = true;
      }
    },
    keyShift: function(press, lock) {
      this.shiftPressed = press;
      this.shiftLocked = !!lock;
      if (press && lock && !this.isPlaying()) {
        this.shouldPlay = true;
      }
    },
    blur: function() {
      this.input = 0;
      this.shiftPressed = false;
      this.shiftLocked = false;
    },
    touch: function(touches, eventType) {
      if (eventType === 'start' && touches.length === 3) {
        // Toggle shift by 3 fingers.
        this.handlers.keyShift.call(this, !this.shiftPressed, true);
        return;
      }
      var pressLeft = false;
      var pressRight = false;
      if (touches.length) {
        var lastTouch = touches[touches.length - 1];
        if (lastTouch.pageX / window.innerWidth < 0.5) {
          pressLeft = true;
        } else {
          pressRight = true;
        }
      }
      this.handlers.keyLeft.call(this, pressLeft);
      this.handlers.keyRight.call(this, pressRight);
    }
  },

  handlesTouch: function(e) {
    if (!this.$super.apply(this, arguments)) {
      return false;
    }
    // Touch on authorized champion elements is necessary.
    var elem = this.recordElems.authorizedChampion.container;
    return !$.contains(elem.get(0), e.target);
  },

  releaseLockedShift: function() {
    if (this.shiftLocked) {
      this.shiftPressed = false;
      this.shiftLocked = false;
    }
  },

  reset: function() {
    this.input = 0;

    this.releaseLockedShift();
    this.showSplash();

    delete this.difficulty;
    delete this.direction;
  },

  loadReplay: function(replay) {
    this.replay     = replay;
    this.replaying  = true;
    this.shouldPlay = true;
  },

  upScore: function() {
    this.scores.current++;
    this.updateScore();
  },

  updateScore: function(score) {
    if (score !== undefined) {
      this.scores.current = score;
    }
    this.renderScores();
  },

  renderScores: function() {
    var $$$ = this.recordElems;
    var r = this.scores;
    $$$.current.text(r.current);
    if (r.prime <= r.current ||
        r.prime <= r.champion.score && r.champion.authorized) {
      $$$.prime.hide();
    } else {
      $$$.prime.show().text(r.prime);
    }
  },

  renderChampion: function() {
    var $$$ = this.recordElems;
    var r = this.scores;
    var champions = [$$$.champion, $$$.authorizedChampion];
    if (r.champion.score <= 0) {
      $.each(champions, function() { this.container.hide(); });
      return;
    }
    var i = Number(r.champion.authorized);
    var j = Number(!r.champion.authorized);
    champions[i].container.show();
    champions[i].score.text(r.champion.score);
    champions[i].name.val(r.champion.name);
    champions[j].container.hide();
  },

  _championReceived: function(data) {
    var score = Number(data.score);
    var name = String(data.name);

    this.scores.champion.score = score;
    this.scores.champion.name = name;

    var justBeaten = Boolean(data.token);

    if (justBeaten) {
      var token = String(data.token);
      this.scores.champion.token = token;
      this.scores.champion.authorized = true;
      // if (data.expiresAt && cookies.get('champion-token') !== token) {
      //   cookies.set('champion-token', token, {
      //     expires: new Date(data.expiresAt),
      //   });
      // }
    } else {
      this.scores.champion.authorized = Boolean(data.authorized);
    }

    // var cachedName = cookies.get('champion-name');
    var cachedName = '';
    if (this.scores.champion.authorized) {
      // cookies.set('champion-name', name, {expires: Infinity});
    }

    this.renderScores();
    this.renderChampion();

    if (justBeaten && !cachedName) {
      // Suggest renaming.
      var input = this.recordElems.authorizedChampion.name;
      input.focus();
    }
  },

  _authChampion: function(headers) {
    headers = $.extend({}, headers);
    // var championToken = cookies.get('champion-token');
    // if (championToken) {
    //   headers['Authorization'] = 'Basic ' + btoa(':' + championToken);
    // }
    return headers;
  },

  loadChampion: function() {
    if (!this.ctx.championURL) {
      return {then: $.noop};
    }
    return $.ajax(this.ctx.championURL, {
      method: 'GET',
      dataType: 'json',
      headers: this._authChampion(),
      success: $.proxy(this._championReceived, this)
    });
  },

  beatChampion: function() {
    // Gameplay duration should not be calculated in an Ajax callback.
    var duration = this.time - this.startedAt;

    this.loadChampion().then($.proxy(function() {
      if (this.scores.champion.score === null) {
        return;
      } else if (this.scores.current <= this.scores.champion.score) {
        return;
      }

      // Predict a success.
      // var name = cookies.get('champion-name') || '';
      var name = '';
      this._championReceived({
        score: this.scores.current,
        name: name,
        token: this.scores.champion.token,
        authorized: true
      });

      // Don't beat champion in these special modes.
      if (this.replaying) {
        return;
      } else if (this.ctx.debug) {
        return;
      }

      var durationSeconds = duration / 1000;
      var encodedReplay = Replay.encode(this.replay);

      $.ajax(this.ctx.championURL, {
        method: 'PUT',
        data: {
          score:    this.scores.current,
          name:     name,
          replay:   encodedReplay,
          duration: durationSeconds
        },
        dataType: 'json',
        success: $.proxy(this._championReceived, this)
      });
    }, this));
  },

  renameChampion: function(name) {
    if (name === this.scores.champion.name) {
      return;
    }
    $.ajax(this.ctx.championURL, {
      method: 'PUT',
      dataType: 'json',
      headers: this._authChampion(),
      data: {name: name},
      success: $.proxy(this._championReceived, this)
    });
  },

  gameOver: function() {
    this.player.die();

    var actuallyPlayed = !this.replaying;
    if (actuallyPlayed) {
      if (this.scores.prime < this.scores.current) {
        this.scores.prime = this.scores.current;
        // Remember new prime score.
        // cookies.set('prime-score', this.scores.prime, {
        //   expires: 2592000  // expires in 30 days.
        // });
      }

      this.beatChampion();
    }

    if (this.ctx.triggerEvents) {
      // Trigger custom event to track the score by outside.
      var args  = [this.scores.current, Replay.clone(this.replay)];
      $(window).trigger('gameOver', args);
      window.end_score = this.scores.current;
      var encodedReplay = Replay.encode(Replay.clone(this.replay));
      var replayQuerystring = encodeURIComponent(encodedReplay);
      window.replayQuerystring = replayQuerystring;

      try{
        let div = document.getElementById('score');
        div.innerHTML = "score: " + this.scores.current;
      }catch(e){
        // console.log(e);
      }
      window.active = false;
      setTimeout(()=>{
        $("div.spanner").addClass("show");
        $("div.overlay").addClass("show");

        if(window.QUERY && window.QUERY.log){
          try{
            document.getElementsByTagName('button')[0].style="display: none"
            document.getElementsByTagName('button')[1].style="display: none"
            if(window.QUERY.topScore != this.scores.current){
              alert("가짜 기록 발견. 커뮤니티로 제보해주세요.");
            }
          }catch(e){
          }
        }
      }, 1000);
    }
  },

  update: function(frame) {
    this.ctx.timeScale = (this.ctx.debug && this.shiftPressed) ? 0.5 : 1;

    if (!this.isPlaying()) {
      if (this.shouldPlay) {
        this.startGameplay();
        this.shouldPlay = false;
      }
      return;
    }

    this.updateGameplay(frame);
  },

  startGameplay: function() {
    gtag('event', 'gamestart', { 'type': window.types, 'user': window.user });
    // Reset frame because the flame spawner depends on frame numbers.
    this.frame = 0;

    this.player = new Subleerunker.Player(this);
    if (this.shiftPressed) {
      // Hommarju for SUBERUNKER's shift-enter easter egg.
      this.player.force *= 0.25;
      this.releaseLockedShift();
    }
    this.disp().addChild(this.player.disp());

    this.scores.current = 0;
    this.updateScore();
    this.hideSplash();
    this.loadChampion();
    this.direction = 0;
    this.startedAt = this.time;

    if (this.replaying) {
      this.replay.rewind();
      this.ctx.random = new Math.seedrandom(this.replay.randomSeed);
    } else {
      var randomSeed = this.ctx.randomSeed || makeRandomSeed();
      if (window.randomSeed) {
        randomSeed = window.randomSeed;
        // console.log('randomSeed: ' + randomSeed);
      }
      this.ctx.random = new Math.seedrandom(randomSeed);
      this.replay = new Replay(randomSeed);
    }
  },

  updateGameplay: function(frame) {
    // Wait for all objects destroyed when the player is dead.
    if (this.player.dead) {
      var done = true;
      $.each(this.children, function() {
        done = false;
        return false;
      });
      if (done) {
        delete this.player;
        this.replaying = false;
        this.reset();
      }
      return;
    }

    // Spawn flames when the player is alive.
    if (frame % 2 === 0) {
      if (this.random() < this.difficulty) {
        var flame = new Subleerunker.Flame(this, frame);
        flame.render();
        this.disp().addChild(flame.disp());
      }
      this.difficulty *= 1.001;
    }

    // Record or replay input.
    if (this.replaying) {
      var record = this.replay.nextRecord(frame);
      this.input = record.input;
    } else {
      this.replay.record(frame, this.input);
    }

    // Handle input.
    var movements = [
      {pressed: this.getInputBit(LEFT_PRESSED),  handler: this.player.left},
      {pressed: this.getInputBit(RIGHT_PRESSED), handler: this.player.right}
    ];
    var rightPrior = this.getInputBit(RIGHT_PRIOR);
    var pressed = false;
    for (var i = 0; i < 2; ++i) {
      var mov = movements[rightPrior ? 1 - i : i];
      if (mov.pressed) {
        mov.handler.call(this.player);
        pressed = true;
        break;
      }
    }
    if (!pressed) {
      this.player.rest();
    }
  }
});

$.extend(Subleerunker, {

  Player: GameObject.$extend({

    __name__: 'Player',

    __init__: function(parent) {
      this.$super.apply(this, arguments);
      this.position = parent.width / 2 - this.width / 2;
    },

    update: function(frame) {
      // Decide a blink.
      var BLINK_CONTINUANCE = 4;
      if (frame - this.blink.frame < BLINK_CONTINUANCE) {
        // A blink decision is not changed for 4 frames.
        // To avoid too quick blink.
      } else {
        this.blink = {frame: frame, active: null};

        if (this.blink.active) {
          // Don't close eyes for too long term.
          this.blink.active = false;
        } else {
          // Blinking is not required to be deterministic.
          this.blink.active = (Math.random() < 0.02);
        }
      }

      if (this.dead && this.hasAnimEnded()) {
        this.destroySoon();
      }
    },

    /* Animation */

    anims: {
      idle: {
        fps: 12,
        textureNames: [
          'player-idle-0', 'player-idle-1', 'player-idle-2', 'player-idle-3',
          'player-idle-4', 'player-idle-5', 'player-idle-6'
        ]
      },
      run: {
        fps: 12,
        textureNames: [
          'player-run-0', 'player-run-1', 'player-run-2', 'player-run-3',
          'player-run-4', 'player-run-5', 'player-run-6', 'player-run-7'
        ]
      },
      die: {
        fps: 12,
        once: true,
        textureNames: [
          'player-die-0', 'player-die-1', 'player-die-2', 'player-die-3',
          'player-die-4', 'player-die-5', 'player-die-6', 'player-die-7'
        ]
      }
    },
    animName: 'idle',

    // frame:  the frame decided to blink or not.
    // active: if true, eyes are closed for a short term.
    blink: {frame: 0, active: false},

    renderAnim: function(anim, index) {
      this.overlapEyelids(anim, index);
      this.$super.apply(this, arguments);
    },

    overlapEyelids: function(anim, index) {
      if (this._eyelids) {
        this._eyelids.visible = false;
      }
      if (this.animName === 'die') {
        // There's no eyelids for "die" animation.
        return;
      }
      if (this.blink.active) {
        var disp = this.disp();
        var textureName = anim.textureNames[index] + '-eyelids';
        var eyelidsTexture = this._getTexture(textureName);
        if (this._eyelids) {
          this._eyelids.texture = eyelidsTexture;
          this._eyelids.visible = true;
        } else {
          this._eyelids = new PIXI.Sprite(eyelidsTexture);
          disp.addChild(this._eyelids);
        }
        this._eyelids.x = disp.width * -disp.anchor.x;
        this._eyelids.y = disp.height * -disp.anchor.y;
      }
    },

    /* View */

    width: 48,
    height: 72,
    innerPadding: [10, 18, 50, 18],
    anchor: [0, 1],
    offset: [0, -1],

    /* Move */

    acceleration: 0,
    force: 1,
    friction: 1,
    maxVelocity: 5,
    direction: +1,

    setRunAnim: function(direction) {
      var prevAnimName = this.animName;
      switch (prevAnimName) {
        case 'idle':
          this.rebaseAnimFrame(0);
          break;
        case 'run':
          if (direction !== this.direction) {
            var flippedAnimFrame = this.animFrame() + 4;
            this.rebaseAnimFrame(flippedAnimFrame);
          }
          break;
      }
      this.direction = direction;
      this.setAnim('run');
    },

    left: function() {
      this.acceleration = -this.force;
      this.friction = 0;
      this.setRunAnim(-1);
    },

    right: function() {
      this.acceleration = +this.force;
      this.friction = 0;
      this.setRunAnim(+1);
    },

    rest: function() {
      this.acceleration = 0;
      this.friction = this.force;
      this.setAnim('idle');
    },

    boundary: function() {
      return [0, this.parent.width - this.width];
    },

    visualize: function(state) {
      var disp = this.disp();
      if (disp && !disp._destroyed) {
        disp.x = state.position;
        switch (this.direction) {
          case -1:
            disp.scale.x = -1;
            disp.anchor.x = 1;
            break;
          case +1:
            disp.scale.x = +1;
            disp.anchor.x = 0;
            break;
        }
      }
    },

    /* Own */

    die: function() {
      this.dead = true;
      this.speed = 0;
      this.acceleration = 0;
      this.friction = 0;
      this.setAnim('die');
      this.left = this.right = this.rest = $.noop;
    }

  }),

  Flame: GameObject.$extend({

    __name__: 'Flame',

    __init__: function(parent, id) {
      this.id = id;
      this.$super.apply(this, arguments);
      var W = parent.width;
      var w = this.width;
      this.xPosition = (W - w * 2) * this.random() + w / 2;
      this.position = -this.height;
    },

    update: function(frame) {
      if (this.landed) {
        // Already landed.  Destroy when the landing animation is done.
        if (this.hasAnimEnded()) {
          this.destroy();
        }
        return;
      }

      var player = this.parent.player;

      // Ignore if it didn't enter into the hitbox.
      var hitboxMin = this.parent.height - player.height;
      if (this.position < hitboxMin) {
        return;
      }

      // Check if just landed.
      var hitboxMax = this.boundary()[1];
      if (this.position >= hitboxMax) {
        this.landed = true;
        this.setAnim('land');

        if (!player.dead) {
          this.parent.upScore();
        }
        return;
      }

      // If it kills the player, the game is over.
      if (!player.dead && this.hits(player, this.position)) {
        this.destroy();
        this.parent.gameOver();
      }
    },

    /* View */

    width: 24,
    height: 16,
    innerPadding: [8, 8, 2, 8],
    landingMargin: 2,

    /* Animation */

    anims: {
      burn: {
        fps: 12,
        textureNames: [
          'flame-burn-0', 'flame-burn-1', 'flame-burn-2', 'flame-burn-3',
          'flame-burn-4', 'flame-burn-5', 'flame-burn-6'
        ]
      },
      land: {
        fps: 24,
        once: true,
        textureNames: [
          'flame-land-0', 'flame-land-1', 'flame-land-2'
        ]
      }
    },
    animName: 'burn',

    /* Move */

    acceleration: 0.1,
    maxVelocity: 10,

    boundary: function() {
      return [
        -Infinity,
        this.parent.height - this.height - this.landingMargin
      ];
    },

    visualize: function(state) {
      var disp = this.disp();
      if (disp && !disp._destroyed) {
        disp.x = this.xPosition;
        disp.y = state.position;
      }
    },

    /* Own */

    hits: function(player, prevPosition) {
      var flameTop, flameBottom, flameLeft, flameRight;
      var playerTop, playerBottom, playerLeft, playerRight;
      var topHit, leftHit, rightHit;

      flameTop    = prevPosition + this.innerPadding[TOP];
      flameBottom = this.position + this.height - this.innerPadding[BOTTOM];
      flameLeft   = this.xPosition + this.innerPadding[LEFT];
      flameRight  = this.xPosition + this.width - this.innerPadding[RIGHT];

      var H = this.parent.height;
      var p = player;

      playerTop    = H - p.height + p.innerPadding[TOP];
      playerBottom = H - p.innerPadding[BOTTOM];
      playerLeft   = p.position + p.innerPadding[LEFT];
      playerRight  = p.position + p.width - p.innerPadding[RIGHT];

      topHit   = (flameTop <= playerBottom) && (playerTop <= flameBottom);
      leftHit  = playerLeft <= flameLeft  && flameLeft  <= playerRight;
      rightHit = playerLeft <= flameRight && flameRight <= playerRight;

      return topHit && (leftHit || rightHit);
    }

  })

});

var Replay = Class.$extend({

  __init__: function(randomSeed) {
    this.randomSeed        = randomSeed;
    this.inputHistory      = {};
    this.length            = 0;
    this.lastRecordedInput = 0;
    this.rewind();
  },

  record: function(frame, input) {
    if (input === this.lastRecordedInput) {
      return false;
    }
    this.lastRecordedInput   = input;

    this.inputHistory[frame] = input;
    this.length += 1;

    return true;
  },

  /**
   * Returns the last replayed record as a copied object.
   */
  nextRecord: function(expectedFrame) {
    var frame = ++this._replayingFrame;
    if (expectedFrame !== undefined) {
      // pass checksum
    } else if (this._replayingBaseFrame + frame !== expectedFrame) {
      throw new Error('replaying frame and expected frame not same');
    }

    var input = this.inputHistory[frame];
    if (input !== undefined) {
      this._replayedRecord.input = input;
      this._replayedRecord.frame = frame;
      this._replayedRecord.offset += 1;
    }

    return this.lastRecord();
  },

  /**
   * Returns the last replayed record as a copied object.
   */
  lastRecord: function() {
    var record = {};
    $.extend(record, this._replayedRecord);
    return record;
  },

  /**
   * Resets the cursor for nextRecord().
   */
  rewind: function(baseFrame) {
    this._replayingBaseFrame = baseFrame || 0;
    this._replayingFrame     = 0;
    this._replayedRecord  = {input: 0, frame: 0, offset: -1};
  },

  __classvars__: {

    /**
     * Encodes a replay into a string.
     *
     * Structure:
     *
     *   VERSION!RANDOM_SEED!DELTA_FRAME1.INPUT1!DELTA_FRAME2.INPUT2;...
     *
     * All numbers are encoded in hexadecimal to reduce the size of result
     * strings.
     *
     * The encoded string can be decoded by Replay.decode().
     *
     */
    encode: function(replay) {
      var words = [];

      var version = 2;
      words.push(version.toString(10));

      var randomSeedHex = replay.randomSeed.toString(16);
      words.push(randomSeedHex);

      // Sort input history by frame.
      var sortedInputHistory = [];
      $.each(replay.inputHistory, function(frame, input) {
        sortedInputHistory.push({frame: frame, input: input});
      });
      sortedInputHistory.sort(function(a, b) {
        return a.frame - b.frame;
      });

      var frame = 0;
      for (var i = 0; i < sortedInputHistory.length; ++i) {
        // Use delta frame instead of raw frame to reduce result size.
        var deltaFrame = sortedInputHistory[i].frame - frame;
        frame          = sortedInputHistory[i].frame;

        var input      = sortedInputHistory[i].input;

        var deltaFrameHex = deltaFrame.toString(16);
        var inputHex      = input.toString(16);
        words.push(deltaFrameHex + '.' + inputHex);
      }

      return words.join('!');
    },

    /**
     * Decodes an encoded replay string.
     *
     * A replay can be encoded by Replay.encode().
     *
     */
    decode: function(encodedReplay) {
      // The version number is at ahead of the encoded replay.
      // parseInt() can detect first digits of a string.
      // So parseInt() of the encoded replay returns the version number.
      var version = parseInt(encodedReplay, 10);

      switch (version) {
        case 2:
          return Replay._decodeV2(encodedReplay);
        case 1:
          return Replay._decodeV1(encodedReplay);
      }

      return null;
    },

    /**
     * Decodes an encoded replay string at version-2.  Version-2 changed
     * delimiters for URI awareness.
     *
     * Structure:
     *
     *   VERSION!RANDOM_SEED!DELTA_FRAME1.INPUT1!DELTA_FRAME2.INPUT2;...
     *
     * Use Replay.decode() instead.  The version is automatically resolved.
     *
     */
    _decodeV2: function(encodedReplay) {
      var words = encodedReplay.split('!');
      words.shift();  // discard version

      var randomSeedHex = words.shift();
      var randomSeed    = parseInt(randomSeedHex, 16);

      var replay = new Replay(randomSeed);

      // Read input history.
      var frame = 0;
      var input = 0;
      while (words.length !== 0) {
        var control = words.shift();

        var deltaFrameAndInput = control.split('.');
        var deltaFrameHex      = deltaFrameAndInput[0];
        var inputHex           = deltaFrameAndInput[1];

        var deltaFrame = parseInt(deltaFrameHex, 16);
        input          = parseInt(inputHex, 16);

        frame += deltaFrame;
        replay.record(frame, input);
      }
      replay.lastRecordedInput = input;

      return replay;
    },

    /**
     * Decodes an encoded replay string at version-1.
     *
     * Structure:
     *
     *   VERSION;RANDOM_SEED;DELTA_FRAME1:INPUT1;DELTA_FRAME2:INPUT2;...
     *
     * Use Replay.decode() instead.  The version is automatically resolved.
     *
     */
    _decodeV1: function(encodedReplay) {
      var words = encodedReplay.split(';');
      words.shift();  // discard version

      var randomSeedHex = words.shift();
      var randomSeed    = parseInt(randomSeedHex, 16);

      var replay = new Replay(randomSeed);

      // Read input history.
      var frame = 0;
      var input = 0;
      while (words.length !== 0) {
        var control = words.shift();

        var deltaFrameAndInput = control.split(':');
        var deltaFrameHex      = deltaFrameAndInput[0];
        var inputHex           = deltaFrameAndInput[1];

        var deltaFrame = parseInt(deltaFrameHex, 16);
        input          = parseInt(inputHex, 16);

        frame += deltaFrame;
        replay.record(frame, input);
      }
      replay.lastRecordedInput = input;

      return replay;
    },

    clone: function(replay) {
      var replayClone = new Replay(replay.randomSeed);
      $.extend(replayClone.inputHistory, replay.inputHistory);
      replayClone.lastRecordedInput = replay.lastRecordedInput;
      return replayClone;
    }

  }

});

/**
 * A helper function to simulate a replay to get the result score.  It runs the
 * game in headless mode.  So the result can be determined very quickly.
 */
function replayResult(encodedReplay) {
  var game   = Subleerunker();
  var replay = Replay.decode(encodedReplay);
  game.loadReplay(replay);

  var time = 0;
  var dt   = (1000 / 60) * 6;  // (second / fps) * max_steps

  // play the game
  game.shouldPlay = true;
  while (!game.isPlaying()) {
    game.tick(time);
    time += dt;
  }

  // replay until game over
  while (game.isPlaying()) {
    game.tick(time);
    time += dt;
  }

  var score      = game.scores.current;
  var lastRecord = replay.lastRecord();
  return {
    score:          score,
    inputs:         replay.length,
    replayedInputs: lastRecord.offset + 1
  };
}
