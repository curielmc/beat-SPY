#!/usr/bin/env python3
"""Setup configuration for cli-anything-beatspy package."""

from setuptools import setup, find_packages

setup(
    name='cli-anything-beatspy',
    version='1.0.0',
    description='Interactive CLI for Beat the S&P 500 trading simulation management',
    author='MYeCFO',
    packages=find_packages(),
    install_requires=[
        'click>=8.0',
        'prompt-toolkit>=3.0',
        'requests>=2.26',
        'tabulate>=0.8',
    ],
    extras_require={
        'dev': [
            'pytest>=7.0',
            'pytest-cov>=3.0',
            'black>=22.0',
            'flake8>=4.0',
        ]
    },
    entry_points={
        'console_scripts': [
            'cli-anything-beatspy=cli_anything.beatspy.beatspy_cli:main',
        ]
    },
    python_requires='>=3.8',
)
