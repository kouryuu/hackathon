(function() {
  var RESULT_SIZE;

  RESULT_SIZE = 5;

  self.JSREPLEngine = (function() {
    function JSREPLEngine(input, output, result, error, sandbox, ready) {
      this.sandbox = sandbox;
      this.printed = false;
      this.finished = false;
      this.inputting = false;
      this.lines = 0;
      this.sandbox._init();
      this.sandbox._error = (function(_this) {
        return function(e) {
          _this.finished = true;
          return error(e);
        };
      })(this);
      this.sandbox._print = (function(_this) {
        return function(str) {
          _this.printed = true;
          return output(str);
        };
      })(this);
      this.sandbox._prompt = (function(_this) {
        return function() {
          if (--_this.lines === 0 && !_this.inputting && !_this.finished) {
            return _this.sandbox._finish();
          }
        };
      })(this);
      this.sandbox._input = (function(_this) {
        return function(callback) {
          if (_this.finished) {
            return;
          }
          _this.inputting = true;
          return input(function(result) {
            var chr, _i, _len;
            for (_i = 0, _len = result.length; _i < _len; _i++) {
              chr = result[_i];
              _this.sandbox.inbuf.push(chr.charCodeAt(0));
            }
            _this.sandbox.inbuf.push(13);
            _this.inputting = false;
            return callback();
          });
        };
      })(this);
      this.sandbox._finish = (function(_this) {
        return function() {
          var top;
          if (_this.finished) {
            return;
          }
          _this.sandbox.inbuf = [];
          top = _this.sandbox._stacktop(RESULT_SIZE + 1);
          if (top.length) {
            if (top.length > RESULT_SIZE) {
              top[0] = '...';
            }
            result(top.join(' '));
          } else {
            if (_this.printed) {
              output('\n');
            }
            result('');
          }
          return _this.finished = true;
        };
      })(this);
      ready();
    }

    JSREPLEngine.prototype.Eval = function(command) {
      var e;
      this.printed = false;
      this.finished = false;
      this.inputting = false;
      this.lines = command.split('\n').length;
      try {
        return this.sandbox._run(command);
      } catch (_error) {
        e = _error;
        this.sandbox._error(e);
      }
    };

    JSREPLEngine.prototype.EvalSync = function(command) {};

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      var countParens, parens_in_last_line;
      countParens = (function(_this) {
        return function(str) {
          var depth, token, _i, _len, _ref;
          depth = 0;
          _ref = str.split(/\s+/);
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            token = _ref[_i];
            switch (token) {
              case ':':
                ++depth;
                break;
              case ';':
                --depth;
            }
          }
          return depth;
        };
      })(this);
      if (countParens(command) <= 0) {
        return false;
      } else {
        parens_in_last_line = countParens(command.split('\n').slice(-1)[0]);
        if (parens_in_last_line > 0) {
          return 1;
        } else if (parens_in_last_line < 0) {
          return parens_in_last_line;
        } else {
          return 0;
        }
      }
    };

    return JSREPLEngine;

  })();

}).call(this);
