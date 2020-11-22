package interfaces;

public interface AlgorithmInterface {
	
	// This method receives a path where the images are stored and must produce a preds file containing the result 
	// associated with each image and a csv file with the measures for that image. 
	public abstract boolean applyAlgorithm(String path);
	
	
	public abstract boolean applyAlgorithmSingleImage(String absolutePath,String name);

}
