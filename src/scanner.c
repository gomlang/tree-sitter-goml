#include "tree_sitter/parser.h"
#include <stdint.h>

enum TokenType { RAW_STRING_LITERAL, RAW_BYTE_STRING_LITERAL };

void *tree_sitter_goml_external_scanner_create(void) { return NULL; }
void tree_sitter_goml_external_scanner_destroy(void *payload) { (void)payload; }
unsigned tree_sitter_goml_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}
void tree_sitter_goml_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_goml_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;
  if (!valid_symbols[RAW_STRING_LITERAL] && !valid_symbols[RAW_BYTE_STRING_LITERAL]) return false;
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' || lexer->lookahead == '\n' || lexer->lookahead == '\f' || lexer->lookahead == '\v') {
    lexer->advance(lexer, true);
  }
  bool bytes = lexer->lookahead == 'b';
  if (bytes) {
    if (!valid_symbols[RAW_BYTE_STRING_LITERAL]) return false;
    lexer->advance(lexer, false);
  } else if (!valid_symbols[RAW_STRING_LITERAL]) {
    return false;
  }
  if (lexer->lookahead != 'r') return false;
  lexer->advance(lexer, false);
  uint32_t hashes = 0;
  while (lexer->lookahead == '#') {
    if (hashes == UINT32_MAX) return false;
    ++hashes;
    lexer->advance(lexer, false);
  }
  if (lexer->lookahead != '"') return false;
  lexer->advance(lexer, false);
  while (!lexer->eof(lexer)) {
    if (lexer->lookahead == '"') {
      lexer->advance(lexer, false);
      uint32_t closing = 0;
      while (closing < hashes && lexer->lookahead == '#') {
        ++closing;
        lexer->advance(lexer, false);
      }
      if (closing == hashes) {
        lexer->mark_end(lexer);
        lexer->result_symbol = bytes ? RAW_BYTE_STRING_LITERAL : RAW_STRING_LITERAL;
        return true;
      }
    } else {
      if (bytes && lexer->lookahead > 127) return false;
      lexer->advance(lexer, false);
    }
  }
  return false;
}
