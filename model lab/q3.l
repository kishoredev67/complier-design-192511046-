%{
#include <stdio.h>
%}

%%

[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,} { printf("Valid Email Address: %s\n", yytext); }
[^\n\t ]+                                     { printf("Invalid Email Address: %s\n", yytext); }
[ \t\n]+                                      ; /* Ignore whitespace */

%%

int yywrap() {
    return 1;
}

int main() {
    printf("Enter email address to validate:\n");
    yylex();
    return 0;
}