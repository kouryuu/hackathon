(function() {
  self.JSREPLEngine = (function() {
    function JSREPLEngine(input, output, result, error, sandbox, ready) {
      var error_handler, input_handler, output_handler;
      this.error = error;
      this.sandbox = sandbox;
      input_handler = (function(_this) {
        return function() {
          return input(function(text) {
            return _this.machine.resume(text);
          });
        };
      })(this);
      output_handler = (function(_this) {
        return function(text) {
          output(text);
          return _this.machine.resume();
        };
      })(this);
      error_handler = (function(_this) {
        return function(e) {
          error(e);
          _this.machine.reset();
          _this.machine.halted = true;
          return _this.machine.instruction_ptr = _this.machine.instructions.length;
        };
      })(this);
      this.result_handler = (function(_this) {
        return function() {
          var it;
          it = _this.machine.frames[0].variables['IT'];
          if (it === _this.last_it) {
            return result('');
          } else {
            _this.last_it = it;
            return result(it.value === null ? '' : String(it.value));
          }
        };
      })(this);
      this.context = new this.sandbox.LOLCoffee.CodeGenContext;
      this.machine = new this.sandbox.LOLCoffee.Machine(this.context, input_handler, output_handler, error_handler, this.result_handler, true);
      this.last_it = null;
      ready();
    }

    JSREPLEngine.prototype.Compile = function(command) {
      var parsed, tokenized;
      tokenized = new this.sandbox.LOLCoffee.Tokenizer(command).tokenize();
      parsed = new this.sandbox.LOLCoffee.Parser(tokenized).parseProgram();
      return parsed.codegen(this.context);
    };

    JSREPLEngine.prototype.Eval = function(command) {
      var e;
      try {
        this.Compile(command);
      } catch (_error) {
        e = _error;
        this.error(e);
        return;
      }
      return this.machine.run();
    };

    JSREPLEngine.prototype.EvalSync = function(command) {
      var it;
      this.Compile(command);
      this.machine.done = function() {};
      this.machine.run();
      this.machine.done = this.result_handler;
      it = this.machine.frames[0].variables['IT'];
      if (it === this.last_it) {
        return null;
      } else {
        this.last_it = it;
        return it.value;
      }
    };

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      var countBlocks, current_line, e, lines, parsed, token, tokenized, _i, _len;
      if (/\.\.\.\s*$/.test(command)) {
        return 0;
      }
      try {
        tokenized = new this.sandbox.LOLCoffee.Tokenizer(command).tokenize();
      } catch (_error) {
        e = _error;
        return false;
      }
      try {
        parsed = new this.sandbox.LOLCoffee.Parser(tokenized.slice(0)).parseProgram();
        return false;
      } catch (_error) {
        e = _error;
        lines = [];
        current_line = [];
        for (_i = 0, _len = tokenized.length; _i < _len; _i++) {
          token = tokenized[_i];
          if (token.type === 'endline') {
            lines.push(current_line);
            current_line = [];
          } else {
            current_line.push(token);
          }
        }
        countBlocks = function(lines, partial) {
          var line, open_blocks, top_block, _j, _len1;
          if (partial == null) {
            partial = false;
          }
          open_blocks = [];
          for (_j = 0, _len1 = lines.length; _j < _len1; _j++) {
            line = lines[_j];
            top_block = open_blocks[open_blocks.length - 1];
            switch (line[0].text) {
              case 'HAI':
                open_blocks.push('KTHXBYE');
                break;
              case 'HOW DUZ I':
                open_blocks.push('IF U SAY SO');
                break;
              case 'IM IN YR':
                open_blocks.push('IM OUTTA YR');
                break;
              case 'O RLY?':
              case 'WTF?':
                open_blocks.push('OIC');
                break;
              case 'YA RLY':
              case 'NO WAI':
              case 'MEBBE':
                if (partial && open_blocks.length === 0) {
                  open_blocks.push('OIC');
                } else if (open_blocks[open_blocks.length - 1] !== 'OIC') {
                  return -1;
                }
                break;
              case 'KTHXBYE':
              case 'IF U SAY SO':
              case 'IM OUTTA YR':
              case 'OIC':
                if (open_blocks[open_blocks.length - 1] === line[0].text) {
                  open_blocks.pop();
                } else {
                  return -1;
                }
            }
          }
          return open_blocks.length;
        };
        if (countBlocks(lines) <= 0) {
          return false;
        } else {
          if (countBlocks([lines.slice(-1)[0]], true) > 0) {
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
