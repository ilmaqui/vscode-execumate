import { window } from "vscode";

export class InputBoxFlow {
  private inputBox = window.createInputBox();
  private step = 1;
  private totalSteps: number;
  private onComplete: (values: string[]) => void;
  private values: string[] = [];
  private stepHandlers: (() => void)[] = [];

  constructor(
    title: string,
    placeholder: string,
    totalSteps: number,
    onComplete: (values: string[]) => void
  ) {
    this.inputBox.title = title;
    this.inputBox.placeholder = placeholder;
    this.totalSteps = totalSteps;
    this.onComplete = onComplete;

    this.inputBox.step = this.step;
    this.inputBox.show();

    this.inputBox.onDidAccept(() => {
      if (this.step <= this.totalSteps) {
        this.values.push(this.inputBox.value.trim());
        this.inputBox.value = "";
        this.step++;

        if (this.step <= this.totalSteps && this.stepHandlers[this.step - 2]) {
          this.stepHandlers[this.step - 2]();
        } else {
          this.inputBox.hide();
          this.onComplete(this.values);
        }
      }
    });
  }

  addStep(placeholder: string, prompt?: string) {
    this.stepHandlers.push(() => {
      this.inputBox.step = this.step;
      this.inputBox.placeholder = placeholder;
      if (prompt) {
        this.inputBox.prompt = prompt;
      }
    });
  }
}
