# MotilityJ

MotilityJ is an application for the segmentation of motility images. 

## Table of contents

1. [Installation](#installation)
2. [Video](#video)
3. [Models](#models)
4. [Motility plugin](#motility-plugin)
5. [Comparison application](#comparison-application)
6. [Acknowledgments](#Acknowledgments)

## Installation

In order to use MotilityJ, it is necessary to install the following Python package [Deep-Motility](https://pypi.org/project/Deep-Motility). You need to use `pip`:

### Ubuntu

For installing it in Ubuntu use:
```bash
pip3 install imutils Deep-Motility
```

### Windows

First install [Python](https://www.python.org/downloads/). After downloading the Python executable, when installing it, it is important to select the option "Add Python 3 to PATH" in the first window that appears. 

After install Python open the terminal and execute the following commands:

```bash
pip install torch===1.7.1+cpu torchvision===0.8.2+cpu -f https://download.pytorch.org/whl/torch_stable.html
pip install scikit-image==0.18.0rc0 scikit-learn==0.24.0rc1 imutils numpy==1.20.0rc1
pip install Deep-Motility
```
All the code from this package is located in it is own repository [Deep-Motility](https://github.com/joheras/Deep-Motility).

Once that you have installed the Python package, you need to download the [Java application](https://github.com/joheras/MotilityJ/releases/download/v0.1/Motilidad.jar). You may need to install [Java](https://www.java.com/es/download/).

## Video

You can see how to use MotilityJ in the following video.

## Models

MotilityJ uses two deep learning models. A classification model for classifying images as complete or incomplete, and a segmentation model for segmenting the incomplete images. The code for training the models is available at the [Deep Motility page](https://github.com/joheras/Deep-Motility/tree/main/training). The datasets used for training and testing the models are [freely available](https://unirioja-my.sharepoint.com/:f:/g/personal/joheras_unirioja_es/Emp47LEiEDtBmiJBQBYnCN4BzQvuNxF9yR0fP3RYkCX9QA?e=0tfXic). The models that we have created are also [freely available](https://www.dropbox.com/sh/iykifqvhrnwbxfg/AACVciFDoP_ipG6oOedzfK-7a?dl=0).


## Motility plugin


## Comparison application

We have created a [java application for comparing two kinds of annotations](https://github.com/joheras/Comparator). Using this application, we have shown that the annotation produced by MotilityJ is indistinguisable from that produced by human experts.  

## Acknowledgements

This work was partially supported by Ministerio de Economía y Competitividad (MTM2017-88804-P).

Icons of the application were taken from [flaticon](https://www.flaticon.es/).
