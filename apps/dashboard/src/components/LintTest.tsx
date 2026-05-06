import React from 'react';
export const Test = () => {
  const [s, setS] = React.useState(0);
  React.useEffect(() => {
    setS(1);
  }, []);
  return <div>{s}</div>;
};
