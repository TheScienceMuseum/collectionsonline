function underscoredVal (val) {
  return val.replace(/ /g, '_');
}
module.exports = {
  getImageUrl: async (data, qCode) => {
    const value =
      data[qCode].claims.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
    const imgPath = value ? underscoredVal(value) : null;

    const imageUrl = imgPath
      ? `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${imgPath}`
      : null;
    return imageUrl;
  },
  getLogo: (data, qCode) => {
    const { value } = data[qCode].claims.P154[0].mainsnak.datavalue;
    const imgPath = underscoredVal(value);
    const logoSrc = `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${imgPath}`;
    return logoSrc;
  }
};
