import { ScalprumComponent } from '@scalprum/react-core';
import React from 'react';
import LoadingComponent from '../components/LoadingComponent';

const RuntimeErrorRoute = () => {
  return (
    <div>
      <h2>Runtime error route</h2>
      <ScalprumComponent LoadingComponent={LoadingComponent} appName="testApp" scope="testApp" module="./ErrorModule" />
    </div>
  );
};

export default RuntimeErrorRoute;
