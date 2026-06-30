.PHONY: clean distclean

clean:
	rm -rf .pytest_cache __pycache__
	rm -rf backend/__pycache__ backend/tests/__pycache__ tests/__pycache__
	rm -rf frontend/.expo frontend/.metro-cache frontend/dist frontend/expo-env.d.ts
	rm -rf deployment/.env
	find . -name .git -prune -o -name '.DS_Store' -type f -exec rm -f {} +

distclean: clean
	rm -rf backend/.venv frontend/node_modules
