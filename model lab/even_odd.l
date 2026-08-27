%{
#include <stdio.h>
#include <stdlib.h>
int num;
%}

%%

[0-9]+ {
    num = atoi(yytext);
    if (num % 2 == 0) {
        printf("Even Integer: %d\n", num);
    } else {
        printf("Odd Integer: %d\n", num);
    }
}

[ \t\n]+ ; /* Ignore whitespace */
.        ; /* Ignore invalid characters */

%%

int yywrap() {
    return 1;
}

int main() {
    printf("Enter integers:\n");
    yylex();
    return 0;
}