(function() {
  var SCOPE_OPENERS,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  SCOPE_OPENERS = ['FOR', 'WHILE', 'UNTIL', 'LOOP', 'IF', 'POST_IF', 'SWITCH', 'WHEN', 'CLASS', 'TRY', 'CATCH', 'FINALLY'];

  self.JSREPLEngine = (function() {
    function JSREPLEngine(input, output, result, error, sandbox, ready) {
      this.result = result;
      this.error = error;
      this.sandbox = sandbox;
      this.inspect = this.sandbox.console.inspect;
      this.CoffeeScript = this.sandbox.CoffeeScript;
      this.sandbox.__eval = this.sandbox["eval"];
      ready();
    }

    JSREPLEngine.prototype.Eval = function(command) {
      var compiled, e, result;
      try {
        compiled = this.CoffeeScript.compile(command, {
          globals: true,
          bare: true
        });
        result = this.sandbox.__eval(compiled);
        return this.result(result === void 0 ? '' : this.inspect(result));
      } catch (_error) {
        e = _error;
        return this.error(e);
      }
    };

    JSREPLEngine.prototype.RawEval = function(command) {
      var compiled, e, result;
      try {
        compiled = this.CoffeeScript.compile(command, {
          globals: true,
          bare: true
        });
        result = this.sandbox.__eval(compiled);
        return this.result(result);
      } catch (_error) {
        e = _error;
        return this.error(e);
      }
    };

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      var all_tokens, e, index, last_line, last_line_tokens, next, scopes, token, _i, _j, _len, _len1, _ref;
      last_line = command.split('\n').slice(-1)[0];
      if (/([-=]>|[\[\{\(]|\belse)$/.test(last_line)) {
        return 1;
      } else {
        try {
          all_tokens = this.CoffeeScript.tokens(command);
          last_line_tokens = this.CoffeeScript.tokens(last_line);
        } catch (_error) {
          e = _error;
          return 0;
        }
        try {
          this.CoffeeScript.compile(command);
          if (/^\s+/.test(last_line)) {
            return 0;
          } else {
            for (index = _i = 0, _len = all_tokens.length; _i < _len; index = ++_i) {
              token = all_tokens[index];
              next = all_tokens[index + 1];
              if (token[0] === 'REGEX' && token[1] === '/(?:)/' && next[0] === 'MATH' && next[1] === '/') {
                return 0;
              }
            }
            return false;
          }
        } catch (_error) {
          e = _error;
          scopes = 0;
          for (_j = 0, _len1 = last_line_tokens.length; _j < _len1; _j++) {
            token = last_line_tokens[_j];
            if (_ref = token[0], __indexOf.call(SCOPE_OPENERS, _ref) >= 0) {
              scopes++;
            } else if (token.fromThen) {
              scopes--;
            }
          }
          if (scopes > 0) {
            return 1;
          } else {
            return 0;
          }
        }
      }
    };

    return JSREPLEngine;

  })();

}).call(this);
