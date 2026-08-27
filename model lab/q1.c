#include <stdio.h>
#include <stdlib.h>
#include <string.h>

const char *input;
int i = 0;

void S();
void A();
void error();

void match(char expected) {
    if (input[i] == expected) {
        printf("Matched '%c'\n", expected);
        i++;
    } else {
        error();
    }
}

void error() {
    printf("Parsing Failed at position %d ('%c')\n", i, input[i]);
    exit(1);
}

// S -> aA
void S() {
    printf("Applying rule: S -> aA\n");
    match('a');
    A();
}

// A -> bA | c
void A() {
    if (input[i] == 'b') {
        printf("Applying rule: A -> bA\n");
        match('b');
        A();
    } else if (input[i] == 'c') {
        printf("Applying rule: A -> c\n");
        match('c');
    } else {
        error();
    }
}

int main() {
    char str[100];
    printf("Enter string to verify (e.g., abbc): ");
    scanf("%s", str);
    
    input = str;
    i = 0;
    
    printf("\n--- Parsing Sequence ---\n");
    S();
    
    if (input[i] == '\0') {
        printf("\nResult: String successfully parsed!\n");
    } else {
        printf("\nResult: Trailing unparsed characters remaining.\n");
    }
    
    return 0;
}