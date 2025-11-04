from setuptools import setup, find_packages

setup(
    name="flight_planner",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "pytest>=7.0.0",
        "black>=23.0.0",
        "flake8>=6.0.0",
    ],
    author="Your Name",
    author_email="your.email@example.com",
    description="A Python project for planning flights",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/flight_planner",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
)