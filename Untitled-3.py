import subprocess


def main():
	# Initialize a new NestJS project named 'backend'
	subprocess.run(["npx", "@nestjs/cli", "new", "backend"], check=True)

	# Start the development server (run from the created 'backend' directory)
	subprocess.run(["npm", "run", "start:dev"], cwd="backend", check=True)


if __name__ == "__main__":
	main()