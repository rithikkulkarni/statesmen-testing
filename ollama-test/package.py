import ollama

# Initialize the Ollama client
client = ollama.Client()

# Define model and input prompt
model = "granite4.1:3b"
prompt = "What is Python?"

# Send query to model
response = client.generate(model=model, prompt=prompt)

# Print response
print("Response from Ollama:")
print(response.response)