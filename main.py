class BlockFunction:
    def __init__(self, function, input_type, output_type):
        self.function = function
        self.input_type = input_type
        self.output_type = output_type

    def execute(self, input_data):
        if not isinstance(input_data, self.input_type):
            raise TypeError(
                f"Expected input of type {self.input_type}, got {type(input_data)}"
            )
        result = self.function(input_data)
        if not isinstance(result, self.output_type):
            raise TypeError(
                f"Function returned {type(result)}, expected {self.output_type}"
            )
        return result


# Example functions that can be connected to blocks
def number_doubler(x: int) -> int:
    return x * 2


def text_reverser(text: str) -> str:
    return text[::-1]


def string_addition(text1: str, text2: str) -> str:
    return text1 + text2


# Register available functions
available_functions = {
    "number_doubler": BlockFunction(number_doubler, int, int),
    "text_reverser": BlockFunction(text_reverser, str, str),
    "string_addition": BlockFunction(string_addition, (str, str), str),
}


def register_function(name, function, input_type, output_type):
    available_functions[name] = BlockFunction(function, input_type, output_type)


# Example usage:
# register_function('new_function', new_function, str, str)
