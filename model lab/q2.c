#include <stdio.h>
#include <string.h>

struct TAC {
    char op[5];
    char arg1[10];
    char arg2[10];
    char result[10];
};

int main() {
    // Input TAC given in problem:
    // t1 = a + b
    // t2 = t1 - c
    // x = t2
    struct TAC code[3] = {
        {"+", "a", "b", "t1"},
        {"-", "t1", "c", "t2"},
        {"=", "t2", "", "x"}
    };

    printf("--- Target Assembly-like Instructions ---\n");
    for (int i = 0; i < 3; i++) {
        if (strcmp(code[i].op, "+") == 0) {
            printf("MOV R0, %s\n", code[i].arg1);
            printf("ADD R0, %s\n", code[i].arg2);
            printf("MOV %s, R0\n", code[i].result);
        } else if (strcmp(code[i].op, "-") == 0) {
            printf("MOV R0, %s\n", code[i].arg1);
            printf("SUB R0, %s\n", code[i].arg2);
            printf("MOV %s, R0\n", code[i].result);
        } else if (strcmp(code[i].op, "=") == 0) {
            printf("MOV R0, %s\n", code[i].arg1);
            printf("MOV %s, R0\n", code[i].result);
        }
    }

    return 0;
}