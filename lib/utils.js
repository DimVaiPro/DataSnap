
let presentTime = () => {
    let date = new Date();
    return date.toLocaleString('el-GR',{hour12: false});
};

let greekdate = (inputDate) => {
    const date = new Date(inputDate);
    return date.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};



export { presentTime, greekdate };