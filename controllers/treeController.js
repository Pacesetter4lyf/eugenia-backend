const multer = require('multer');
const sharp = require('sharp');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');
const UserData = require('../models/userDataModel');

exports.protectLineage = catchAsync(async (req, res, next) => {
  // get the lineage of the user
  next();
});

exports.tree = catchAsync(async (req, res, next) => {
  // find the relationships and populate them
  const tree = await UserData.findById(req.params.id)
    .populate({
      path: 'mother',
      select: 'firstName lastName _id '
    })
    .populate({
      path: 'child',
      select: 'firstName lastName gender _id'
    })
    .populate({
      path: 'father',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'sibling',
      select: 'firstName lastName gender _id'
    })
    .populate({
      path: 'wife',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'husband',
      select: 'firstName lastName _id'
    });
  res.status(200).json({
    status: 'success',
    data: {
      data: tree
    }
  });
});

const mapRelationships = async (appendTo, appendAs, updatedUser) => {
  // father: my sibling father is my father and my mother husband is my father
  // mother: my sibling mother is my mother and my father wife is my mother

  // father:
  // get siblings

  async function getFather() {
    let mother, father;
    const siblings = updatedUser.siblings;
    const children = await UserData.find({ _id: { $in: siblings } });
    father = Array.from(new Set(children.map(child => child.father)));
    let father1;
    if (father.length > 0) father1 = father[0];

    mother = updatedUser.mother;
    const foundMother = await UserData.find({ _id: mother });
    let father2 = foundMother.husband[0]; // review this
  }

  async function getMother() {
    let mother, father;
    const siblings = updatedUser.siblings;
    const children = await UserData.find({ _id: { $in: siblings } });
    mother = Array.from(new Set(children.map(child => child.mother)));
    let mother1;
    if (mother.length > 0) mother1 = mother[0];

    father = updatedUser.father;
    const foundFather = await UserData.find({ _id: father });
    let mother2 = foundFather.wife[0];
  }

  async function getWife() {
    let children = updatedUser.child;
    let wife;
    if (children.length > 0) {
      children = await UserData.find({ _id: { $in: children } });
      wife = Array.from(new Set(children.map(child => child.mother)));
    }
    return wife;
  }

  async function getHusband() {
    let children = updatedUser.child;
    let husband;
    if (children.length > 0) {
      children = await UserData.find({ _id: { $in: children } });
      husband = Array.from(new Set(children.map(child => child.father)));
    }
    return husband;
  }

  async function getSibling() {
    let sibling1 = updatedUser.sibling;
    if (sibling1.length > 0) {
      sibling1 = await UserData.find({ _id: { $in: sibling1 } });
      sibling1 = Array.from(new Set(sibling1.FlatMap(sib => sib.sibling)));
    }

    let sibling2;
    let father = updatedUser.father;
    father = await UserData.find({ _id: father });
    sibling2 = father.child;

    let sibling3;
    let mother = updatedUser.mother;
    mother = await UserData.find({ _id: mother });
    sibling3 = mother.child;

    return sibling1 || sibling2 || sibling3;
  }

  async function getChildren() {
    let wife = updatedUser.wife;
    let children1;
    if (wife.length > 0) {
      wife = await UserData.find({ _id: { $in: wife } });
      children1 = Array.from(new Set(wife.FlatMap(wife => wife.child)));
    }

    let husband = updatedUser.husband;
    let children2;
    if (husband.length > 0) {
      husband = await UserData.find({ _id: { $in: husband } });
      children2 = Array.from(
        new Set(husband.FlatMap(husband => husband.child))
      );
    }

    let children3;
    children3 = updatedUser.child;
    if (children3.length > 0) {
      children3 = Array.from(
        new Set(children3.FlatMap(child => child.sibling))
      );
    }
  }
  return 'hello';
};
