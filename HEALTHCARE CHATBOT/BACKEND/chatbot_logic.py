def generate_reply(user_message):

    message = user_message.lower()

    if "fever" in message:
        return "You may have fever. Please stay hydrated and monitor temperature."

    elif "headache" in message:
        return "Headaches can be caused by stress or dehydration. Try resting."

    elif "cold" in message:
        return "Common cold detected. Drink warm fluids and take rest."

    elif "cough" in message:
        return "Persistent cough may need medical attention if it lasts more than 3 days."

    elif "hello" in message:
        return "Hello 👋 How can I help you today?"

    return "Please describe your symptoms more clearly."
