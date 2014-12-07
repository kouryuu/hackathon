(function() {
  self.JSREPLEngine = (function() {
    function JSREPLEngine(input, output, result, error, sandbox, ready) {
      this.result = result;
      this.error = error;
      this.sandbox = sandbox;
      this.result_fn_factory = (function(_this) {
        return function(result_fn) {
          return function(data, index) {
            var after, before, cells, epi, i, lower, v, _i, _len;
            epi = '...';
            cells = data.map(function(x) {
              return x;
            });
            cells.length = cells.length < index ? index + 1 : cells.length;
            for (i = _i = 0, _len = cells.length; _i < _len; i = ++_i) {
              v = cells[i];
              cells[i] || (cells[i] = 0);
            }
            if (index < 10) {
              lower = 0;
            } else {
              lower = index - 10;
              cells[lower] = epi + cells[lower];
            }
            cells[index] || (cells[index] = 0);
            before = cells.slice(lower, index);
            if (cells[index + 10] != null) {
              cells[index + 10] += epi;
            }
            after = cells.slice(index + 1, +(index + 10) + 1 || 9e9);
            return result_fn(before.concat(['[' + cells[index] + ']']).concat(after).join(' '));
          };
        };
      })(this);
      this.result_handler = this.result_fn_factory(this.result);
      this.BFI = new this.sandbox.BF.Interpreter(input, output, this.result_handler);
      ready();
    }

    JSREPLEngine.prototype.Eval = function(command) {
      var e;
      try {
        if (command === "SHOWTAPE") {
          this.BFI.result = (function(_this) {
            return function(data, index) {
              var cells, i, v, _i, _len;
              cells = data.map(function(x) {
                return x;
              });
              cells.length = cells.length < index ? index + 1 : cells.length;
              for (i = _i = 0, _len = cells.length; _i < _len; i = ++_i) {
                v = cells[i];
                cells[i] || (cells[i] = 0);
              }
              cells[index] || (cells[index] = 0);
              cells[index] = '[' + cells[index] + ']';
              return _this.result(cells.join(' '));
            };
          })(this);
          this.BFI.evaluate('');
          return this.BFI.result = this.result_handler;
        } else if (command.match(/^RESET\b/)) {
          this.BFI.reset();
          return this.BFI.evaluate(command.replace(/^RESET/, ''));
        } else {
          return this.BFI.evaluate(command);
        }
      } catch (_error) {
        e = _error;
        return this.error(e);
      }
    };

    JSREPLEngine.prototype.EvalSync = function(command) {
      var ret;
      ret = null;
      this.BFI.result = this.result_fn_factory(function(res) {
        return ret = res;
      });
      this.BFI.evaluate(command);
      this.BFI.result = this.result_handler;
      return ret;
    };

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      var countParens, parens_in_last_line;
      countParens = (function(_this) {
        return function(str) {
          var parens, token, tokens, _i, _len;
          tokens = str.split('');
          parens = 0;
          for (_i = 0, _len = tokens.length; _i < _len; _i++) {
            token = tokens[_i];
            switch (token) {
              case '[':
                ++parens;
                break;
              case ']':
                --parens;
            }
          }
          return parens;
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
