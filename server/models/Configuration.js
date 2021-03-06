"use strict";
const keystone = require("keystone");
const Types = keystone.Field.Types;
const storage = new keystone.Storage({
	adapter: keystone.Storage.Adapters.FS,
	fs: {
		path: keystone.expandPath("../public"), // required; path where the files should be stored
		generateFilename: (file, attempt, cb) => {
			file.extension = getFileExtension(file.originalname);

			if (file.extension !== "ico") {
				return cb("Favicon has to be an .ico file.");
			}
			return cb(null, "favicon.ico");
		},
		whenExists: "overwrite"
	},
	schema: {
		originalname: true,
		url: true,
		filename: true
	}
});

function getFileExtension(filename) {
	return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

var SocialConfiguration = new keystone.List("SocialConfiguration", {
	plural: "Social",
	label: "Social",
	nocreate: true, //Single item
	nodelete: true //Single item
});
SocialConfiguration.add({
	name: { type: String, default: "Social", noedit: true, hidden: true },
	social: {
		facebook: { type: Types.Url },
		twitter: { type: Types.Url },
		instagram: { type: Types.Url },
		snapchat: { type: Types.Url },
		youtube: { type: Types.Url }
	}
});
(SocialConfiguration.defaultColumns =
	"name|16%, social.facebook|16%, social.twitter|16%, social.instagram|16%"),
	"social.snapchat|16%",
	"social.youtube|16%";

SocialConfiguration.register();

var APIsConfiguration = new keystone.List("APIsConfiguration", {
	label: "APIs",
	nocreate: true, //Single item
	nodelete: true //Single item
});
APIsConfiguration.add({
	name: { type: String, default: "APIs", noedit: true, hidden: true },
	key: {
		analytics: { type: Types.Key },
		twitter: { type: Types.Key },
		instagram: { type: Types.Key }
	}
});

APIsConfiguration.register();

var GeneralConfiguration = new keystone.List("GeneralConfiguration", {
	label: "General",
	nocreate: true, //Single item
	nodelete: true //Single item
});
GeneralConfiguration.add({
	name: { type: String, default: "General", noedit: true, hidden: true },
	contact: {
		email: { type: Types.Email, displayGravatar: true },
		phone: { type: String },
		address: { type: Types.Location, defaults: { country: "Denmark" } },
		cvr: { type: String, label: "CVR" }
	},
	favicon: {
		type: Types.File,
		storage: storage,
		allowedTypes: ["ico"]
	}
});
GeneralConfiguration.defaultColumns =
	"name, contact.email|20%, contact.phone|20%, contact.cvr|20%";

GeneralConfiguration.register();

exports = module.exports = {
	GeneralConfiguration,
	SocialConfiguration,
	APIsConfiguration
};
